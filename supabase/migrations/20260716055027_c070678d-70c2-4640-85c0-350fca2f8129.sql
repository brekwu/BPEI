-- =====================================================
-- VAGUE 10 — Cohérence fournisseur stricte + quarantaine
-- =====================================================

-- 1) purchase_order_lines : lien vers l'offre fournisseur + snapshot
ALTER TABLE public.purchase_order_lines
  ADD COLUMN IF NOT EXISTS stock_item_supplier_id UUID NULL
    REFERENCES public.stock_item_suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS snapshot_supplier_reference TEXT NULL,
  ADD COLUMN IF NOT EXISTS snapshot_supplier_product_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS snapshot_min_order_qty NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS snapshot_pack_qty NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS snapshot_lead_days INT NULL,
  ADD COLUMN IF NOT EXISTS snapshot_shipping_cents INT NULL;

CREATE INDEX IF NOT EXISTS idx_po_lines_sis ON public.purchase_order_lines(stock_item_supplier_id);

-- 2) stock_items : ajout de la colonne quarantine_quantity (unités reçues endommagées)
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS quarantine_quantity NUMERIC NOT NULL DEFAULT 0;

-- 3) enum stock_movement_kind : ajout des mouvements de quarantaine
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='quarantine_in'
                 AND enumtypid=(SELECT oid FROM pg_type WHERE typname='stock_movement_kind')) THEN
    ALTER TYPE public.stock_movement_kind ADD VALUE 'quarantine_in';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='quarantine_out'
                 AND enumtypid=(SELECT oid FROM pg_type WHERE typname='stock_movement_kind')) THEN
    ALTER TYPE public.stock_movement_kind ADD VALUE 'quarantine_out';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='quarantine_release'
                 AND enumtypid=(SELECT oid FROM pg_type WHERE typname='stock_movement_kind')) THEN
    ALTER TYPE public.stock_movement_kind ADD VALUE 'quarantine_release';
  END IF;
END $$;

-- 4) Trigger : vérifier cohérence fournisseur sur INSERT/UPDATE d'une ligne
CREATE OR REPLACE FUNCTION public.enforce_po_line_supplier_consistency()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_po_supplier UUID;
  v_po_status TEXT;
  v_sis public.stock_item_suppliers;
BEGIN
  SELECT supplier_id, status INTO v_po_supplier, v_po_status
    FROM public.purchase_orders WHERE id = NEW.purchase_order_id;
  IF v_po_supplier IS NULL THEN
    RAISE EXCEPTION 'purchase order not found';
  END IF;

  -- Bons envoyés/confirmés/reçus : lignes figées (aucune insertion/modif directe hors reception)
  IF TG_OP = 'INSERT' AND v_po_status NOT IN ('draft') THEN
    RAISE EXCEPTION 'cannot add a line to a % purchase order', v_po_status;
  END IF;

  IF TG_OP = 'UPDATE' AND v_po_status NOT IN ('draft') THEN
    -- Autoriser seulement mises à jour techniques (reception) : quantity/received/damaged/notes/position
    IF NEW.stock_item_supplier_id IS DISTINCT FROM OLD.stock_item_supplier_id
       OR NEW.item_id IS DISTINCT FROM OLD.item_id
       OR NEW.unit_price_cents IS DISTINCT FROM OLD.unit_price_cents
       OR NEW.tax_rate IS DISTINCT FROM OLD.tax_rate
       OR NEW.name IS DISTINCT FROM OLD.name
       OR NEW.sku IS DISTINCT FROM OLD.sku THEN
      RAISE EXCEPTION 'purchase order line is frozen (status=%)', v_po_status;
    END IF;
  END IF;

  IF NEW.stock_item_supplier_id IS NOT NULL THEN
    SELECT * INTO v_sis FROM public.stock_item_suppliers WHERE id = NEW.stock_item_supplier_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'stock_item_supplier not found';
    END IF;
    IF v_sis.shop_id <> NEW.shop_id THEN
      RAISE EXCEPTION 'stock_item_supplier belongs to a different shop';
    END IF;
    IF v_sis.supplier_id <> v_po_supplier THEN
      RAISE EXCEPTION 'supplier mismatch: cannot use supplier % on a PO for supplier %', v_sis.supplier_id, v_po_supplier;
    END IF;
    IF NEW.item_id IS NOT NULL AND v_sis.stock_item_id <> NEW.item_id THEN
      RAISE EXCEPTION 'stock_item_supplier does not match line item';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_po_line_supplier ON public.purchase_order_lines;
CREATE TRIGGER trg_enforce_po_line_supplier
  BEFORE INSERT OR UPDATE ON public.purchase_order_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_po_line_supplier_consistency();

-- 5) Empêcher le changement de supplier_id sur un bon envoyé
CREATE OR REPLACE FUNCTION public.enforce_po_supplier_frozen()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.supplier_id IS DISTINCT FROM NEW.supplier_id
     AND OLD.status NOT IN ('draft') THEN
    RAISE EXCEPTION 'supplier cannot be changed on a % purchase order', OLD.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_po_supplier_frozen ON public.purchase_orders;
CREATE TRIGGER trg_enforce_po_supplier_frozen
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_po_supplier_frozen();

-- 6) Étendre send_purchase_order pour figer les snapshots de ligne
CREATE OR REPLACE FUNCTION public.send_purchase_order(_po_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_po public.purchase_orders;
  v_shop public.shops;
  v_sup public.suppliers;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id = _po_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;
  IF v_po.status <> 'draft' THEN
    RAISE EXCEPTION 'only draft PO can be sent (status=%)', v_po.status;
  END IF;
  IF NOT (public.has_shop_role(auth.uid(), v_po.shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), v_po.shop_id, 'network_owner')
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_po.shop_id;
  SELECT * INTO v_sup FROM public.suppliers WHERE id = v_po.supplier_id;

  -- Figer les snapshots par ligne à partir de stock_item_suppliers si présent
  UPDATE public.purchase_order_lines l
     SET snapshot_supplier_reference = COALESCE(l.snapshot_supplier_reference, sis.supplier_product_reference),
         snapshot_supplier_product_name = COALESCE(l.snapshot_supplier_product_name, sis.supplier_product_name),
         snapshot_min_order_qty = COALESCE(l.snapshot_min_order_qty, sis.min_order_qty),
         snapshot_pack_qty = COALESCE(l.snapshot_pack_qty, sis.pack_qty),
         snapshot_lead_days = COALESCE(l.snapshot_lead_days, sis.estimated_delivery_days),
         snapshot_shipping_cents = COALESCE(l.snapshot_shipping_cents, sis.shipping_cost_cents)
    FROM public.stock_item_suppliers sis
   WHERE l.purchase_order_id = _po_id
     AND l.stock_item_supplier_id = sis.id;

  UPDATE public.purchase_orders
     SET status = 'sent',
         sent_at = now(),
         shop_snapshot = to_jsonb(v_shop),
         supplier_snapshot = to_jsonb(v_sup),
         lines_snapshot = (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position)
                           FROM public.purchase_order_lines l WHERE l.purchase_order_id = _po_id)
   WHERE id = _po_id;
END $$;

-- 7) Étendre receive_purchase_order_line pour router les endommagés en quarantaine
CREATE OR REPLACE FUNCTION public.receive_purchase_order_line(
  _shop_id uuid, _line_id uuid, _quantity numeric,
  _note text DEFAULT NULL::text,
  _damaged numeric DEFAULT 0,
  _delivery_note text DEFAULT NULL::text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_line public.purchase_order_lines;
  v_po public.purchase_orders;
  v_all_received boolean;
  v_any_received boolean;
  v_supplier_id UUID;
  v_existing public.stock_item_suppliers;
  v_good numeric;
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0'; END IF;
  IF _damaged IS NULL OR _damaged < 0 THEN _damaged := 0; END IF;
  IF _damaged > _quantity THEN RAISE EXCEPTION 'damaged qty exceeds received qty'; END IF;

  SELECT * INTO v_line FROM public.purchase_order_lines
    WHERE id = _line_id AND shop_id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'line not found'; END IF;

  IF v_line.received_quantity + _quantity > v_line.quantity THEN
    RAISE EXCEPTION 'received quantity exceeds ordered';
  END IF;

  SELECT * INTO v_po FROM public.purchase_orders WHERE id = v_line.purchase_order_id FOR UPDATE;
  IF v_po.status IN ('cancelled','received','closed_variance') THEN
    RAISE EXCEPTION 'purchase order cannot be received (status=%)', v_po.status;
  END IF;
  v_supplier_id := v_po.supplier_id;
  v_good := _quantity - _damaged;

  IF v_line.item_id IS NOT NULL AND v_good > 0 THEN
    PERFORM public.apply_stock_movement(
      _shop_id, v_line.item_id, 'in'::public.stock_movement_kind,
      v_good, 'réception commande (conforme)',
      'purchase_order', v_line.purchase_order_id, _note
    );
  END IF;

  -- Endommagés → quarantaine (colonne dédiée + mouvement typé)
  IF v_line.item_id IS NOT NULL AND _damaged > 0 THEN
    UPDATE public.stock_items
       SET quarantine_quantity = quarantine_quantity + _damaged,
           updated_at = now()
     WHERE id = v_line.item_id AND shop_id = _shop_id;

    INSERT INTO public.stock_movements(
      shop_id, item_id, kind, quantity, balance_after, reason,
      reference_type, reference_id, note, user_id
    )
    SELECT _shop_id, v_line.item_id, 'quarantine_in'::public.stock_movement_kind,
           _damaged, si.quarantine_quantity,
           'réception commande (endommagé)',
           'purchase_order', v_line.purchase_order_id,
           COALESCE(_note, 'unités endommagées à la réception'),
           auth.uid()
      FROM public.stock_items si WHERE si.id = v_line.item_id;
  END IF;

  -- Historisation prix / upsert stock_item_suppliers (uniquement si conforme reçu)
  IF v_line.item_id IS NOT NULL AND v_good > 0 THEN
    SELECT * INTO v_existing FROM public.stock_item_suppliers
      WHERE shop_id = _shop_id AND stock_item_id = v_line.item_id AND supplier_id = v_supplier_id
      FOR UPDATE;
    IF FOUND THEN
      IF v_existing.purchase_price_cents IS DISTINCT FROM v_line.unit_price_cents THEN
        INSERT INTO public.stock_purchase_price_history(
          shop_id, stock_item_id, supplier_id, old_price_cents, new_price_cents,
          source, purchase_order_id, changed_by
        ) VALUES (
          _shop_id, v_line.item_id, v_supplier_id,
          v_existing.purchase_price_cents, v_line.unit_price_cents,
          'po_receive', v_line.purchase_order_id, auth.uid()
        );
        UPDATE public.stock_item_suppliers
          SET purchase_price_cents = v_line.unit_price_cents, last_price_update_at = now()
          WHERE id = v_existing.id;
      END IF;
    ELSE
      INSERT INTO public.stock_item_suppliers(
        shop_id, stock_item_id, supplier_id, purchase_price_cents, tax_rate,
        is_primary, active, created_by, last_price_update_at
      ) VALUES (
        _shop_id, v_line.item_id, v_supplier_id, v_line.unit_price_cents, v_line.tax_rate,
        NOT EXISTS (SELECT 1 FROM public.stock_item_suppliers
                    WHERE shop_id = _shop_id AND stock_item_id = v_line.item_id),
        true, auth.uid(), now()
      );
    END IF;
  END IF;

  UPDATE public.purchase_order_lines
    SET received_quantity = received_quantity + _quantity,
        damaged_quantity  = damaged_quantity  + _damaged,
        reception_notes = CASE WHEN _note IS NULL THEN reception_notes
                               ELSE COALESCE(reception_notes || E'\n', '') || _note END
    WHERE id = _line_id;

  SELECT bool_and(received_quantity >= quantity), bool_or(received_quantity > 0)
    INTO v_all_received, v_any_received
    FROM public.purchase_order_lines WHERE purchase_order_id = v_line.purchase_order_id;

  IF v_all_received THEN
    UPDATE public.purchase_orders
      SET status = 'received', received_date = COALESCE(received_date, CURRENT_DATE),
          delivery_note_reference = COALESCE(_delivery_note, delivery_note_reference)
      WHERE id = v_line.purchase_order_id;
  ELSIF v_any_received THEN
    UPDATE public.purchase_orders SET status = 'partial',
      delivery_note_reference = COALESCE(_delivery_note, delivery_note_reference)
      WHERE id = v_line.purchase_order_id AND status <> 'partial';
  END IF;
END $$;

-- 8) RPC pour traiter les unités en quarantaine
CREATE OR REPLACE FUNCTION public.quarantine_action(
  _shop_id uuid, _item_id uuid, _quantity numeric, _action text, _note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_item public.stock_items;
  v_kind public.stock_movement_kind;
  v_reason text;
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0'; END IF;
  IF _action NOT IN ('return_supplier','destroy','release') THEN
    RAISE EXCEPTION 'invalid action: %', _action;
  END IF;

  SELECT * INTO v_item FROM public.stock_items
    WHERE id = _item_id AND shop_id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;
  IF v_item.quarantine_quantity < _quantity THEN
    RAISE EXCEPTION 'insufficient quarantine stock (available=%, requested=%)',
      v_item.quarantine_quantity, _quantity;
  END IF;

  UPDATE public.stock_items
    SET quarantine_quantity = quarantine_quantity - _quantity, updated_at = now()
    WHERE id = _item_id;

  IF _action = 'release' THEN
    v_kind := 'quarantine_release';
    v_reason := 'quarantaine → stock disponible';
    -- Réintégration contrôlée dans le stock disponible
    PERFORM public.apply_stock_movement(
      _shop_id, _item_id, 'in'::public.stock_movement_kind,
      _quantity, v_reason, 'quarantine_release', _item_id, _note
    );
  ELSE
    v_kind := 'quarantine_out';
    v_reason := CASE _action
      WHEN 'return_supplier' THEN 'retour fournisseur'
      WHEN 'destroy' THEN 'destruction'
    END;
  END IF;

  INSERT INTO public.stock_movements(
    shop_id, item_id, kind, quantity, balance_after, reason,
    reference_type, reference_id, note, user_id
  ) VALUES (
    _shop_id, _item_id, v_kind, _quantity,
    (SELECT quarantine_quantity FROM public.stock_items WHERE id = _item_id),
    v_reason, 'quarantine_action', _item_id, _note, auth.uid()
  );
END $$;

GRANT EXECUTE ON FUNCTION public.quarantine_action(uuid,uuid,numeric,text,text) TO authenticated;