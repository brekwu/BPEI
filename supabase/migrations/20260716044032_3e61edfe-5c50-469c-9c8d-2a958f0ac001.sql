-- =========================================================
-- 1.1 stock_item_suppliers : plusieurs fournisseurs par article
-- =========================================================
CREATE TABLE public.stock_item_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  supplier_product_reference text,
  supplier_product_name text,
  purchase_price_cents integer NOT NULL DEFAULT 0 CHECK (purchase_price_cents >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 20 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  min_order_qty numeric(12,3) NOT NULL DEFAULT 1 CHECK (min_order_qty > 0),
  pack_qty numeric(12,3) NOT NULL DEFAULT 1 CHECK (pack_qty > 0),
  estimated_delivery_days integer CHECK (estimated_delivery_days IS NULL OR estimated_delivery_days >= 0),
  shipping_cost_cents integer NOT NULL DEFAULT 0 CHECK (shipping_cost_cents >= 0),
  is_primary boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  last_price_update_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, stock_item_id, supplier_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_item_suppliers TO authenticated;
GRANT ALL ON public.stock_item_suppliers TO service_role;

ALTER TABLE public.stock_item_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_item_suppliers select shop members"
  ON public.stock_item_suppliers FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));

CREATE POLICY "stock_item_suppliers write managers"
  ON public.stock_item_suppliers FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));

CREATE INDEX idx_stock_item_suppliers_item ON public.stock_item_suppliers(shop_id, stock_item_id);
CREATE INDEX idx_stock_item_suppliers_supplier ON public.stock_item_suppliers(shop_id, supplier_id);
CREATE UNIQUE INDEX uq_stock_item_suppliers_primary
  ON public.stock_item_suppliers(shop_id, stock_item_id)
  WHERE is_primary = true;

CREATE TRIGGER trg_stock_item_suppliers_updated_at
  BEFORE UPDATE ON public.stock_item_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 1.2 Historique des prix d'achat
-- =========================================================
CREATE TABLE public.stock_purchase_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  stock_item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  old_price_cents integer,
  new_price_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  source text NOT NULL CHECK (source IN ('manual','po_receive','import')),
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.stock_purchase_price_history TO authenticated;
GRANT ALL ON public.stock_purchase_price_history TO service_role;

ALTER TABLE public.stock_purchase_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_history select shop members"
  ON public.stock_purchase_price_history FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));

CREATE POLICY "price_history insert managers"
  ON public.stock_purchase_price_history FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));

CREATE INDEX idx_price_history_item ON public.stock_purchase_price_history(shop_id, stock_item_id, changed_at DESC);
CREATE INDEX idx_price_history_supplier ON public.stock_purchase_price_history(shop_id, supplier_id, changed_at DESC);

-- =========================================================
-- Trigger : historise les changements de prix
-- =========================================================
CREATE OR REPLACE FUNCTION public.stock_item_suppliers_track_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.purchase_price_cents > 0 THEN
      INSERT INTO public.stock_purchase_price_history(
        shop_id, stock_item_id, supplier_id, old_price_cents, new_price_cents,
        source, changed_by
      ) VALUES (
        NEW.shop_id, NEW.stock_item_id, NEW.supplier_id, NULL, NEW.purchase_price_cents,
        'manual', COALESCE(NEW.created_by, auth.uid())
      );
      NEW.last_price_update_at := now();
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.purchase_price_cents IS DISTINCT FROM OLD.purchase_price_cents THEN
    INSERT INTO public.stock_purchase_price_history(
      shop_id, stock_item_id, supplier_id, old_price_cents, new_price_cents,
      source, changed_by
    ) VALUES (
      NEW.shop_id, NEW.stock_item_id, NEW.supplier_id,
      OLD.purchase_price_cents, NEW.purchase_price_cents,
      'manual', auth.uid()
    );
    NEW.last_price_update_at := now();
    RETURN NEW;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_stock_item_suppliers_price
  BEFORE INSERT OR UPDATE ON public.stock_item_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.stock_item_suppliers_track_price();

-- =========================================================
-- receive_purchase_order_line : historise le prix réel payé
-- =========================================================
CREATE OR REPLACE FUNCTION public.receive_purchase_order_line(
  _shop_id uuid, _line_id uuid, _quantity numeric, _note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_line public.purchase_order_lines;
  v_po public.purchase_orders;
  v_all_received boolean;
  v_any_received boolean;
  v_supplier_id uuid;
  v_existing public.stock_item_suppliers;
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0'; END IF;

  SELECT * INTO v_line FROM public.purchase_order_lines
    WHERE id = _line_id AND shop_id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'line not found'; END IF;

  IF v_line.received_quantity + _quantity > v_line.quantity THEN
    RAISE EXCEPTION 'received quantity exceeds ordered';
  END IF;

  SELECT status, supplier_id INTO v_po.status, v_supplier_id
    FROM public.purchase_orders WHERE id = v_line.purchase_order_id;

  IF v_po.status IN ('cancelled','received','closed_variance') THEN
    RAISE EXCEPTION 'purchase order cannot be received (status=%)', v_po.status;
  END IF;

  -- Mouvement d'entrée
  IF v_line.item_id IS NOT NULL THEN
    PERFORM public.apply_stock_movement(
      _shop_id, v_line.item_id, 'in'::public.stock_movement_kind,
      _quantity, 'réception commande',
      'purchase_order', v_line.purchase_order_id, _note
    );

    -- Historisation prix + upsert stock_item_suppliers si prix différent
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
          SET purchase_price_cents = v_line.unit_price_cents,
              last_price_update_at = now()
          WHERE id = v_existing.id;
      END IF;
    ELSE
      -- Créer l'association fournisseur/article avec le prix payé
      INSERT INTO public.stock_item_suppliers(
        shop_id, stock_item_id, supplier_id, purchase_price_cents, tax_rate,
        is_primary, active, created_by, last_price_update_at
      ) VALUES (
        _shop_id, v_line.item_id, v_supplier_id, v_line.unit_price_cents, v_line.tax_rate,
        NOT EXISTS (SELECT 1 FROM public.stock_item_suppliers
                    WHERE shop_id = _shop_id AND stock_item_id = v_line.item_id),
        true, auth.uid(), now()
      );
      -- Le trigger insertion crée l'entrée d'historique
    END IF;
  END IF;

  UPDATE public.purchase_order_lines
    SET received_quantity = received_quantity + _quantity
    WHERE id = _line_id;

  SELECT bool_and(received_quantity >= quantity), bool_or(received_quantity > 0)
    INTO v_all_received, v_any_received
    FROM public.purchase_order_lines WHERE purchase_order_id = v_line.purchase_order_id;

  IF v_all_received THEN
    UPDATE public.purchase_orders
      SET status = 'received', received_date = COALESCE(received_date, CURRENT_DATE)
      WHERE id = v_line.purchase_order_id;
  ELSIF v_any_received THEN
    UPDATE public.purchase_orders SET status = 'partial'
      WHERE id = v_line.purchase_order_id AND status <> 'partial';
  END IF;
END $$;