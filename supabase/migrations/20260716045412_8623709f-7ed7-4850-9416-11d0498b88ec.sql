-- Table historique des changements de statut
CREATE TABLE IF NOT EXISTS public.purchase_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  old_status public.purchase_order_status,
  new_status public.purchase_order_status NOT NULL,
  reason TEXT,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.purchase_order_status_history TO authenticated;
GRANT ALL ON public.purchase_order_status_history TO service_role;
ALTER TABLE public.purchase_order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posh_member_select" ON public.purchase_order_status_history
  FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE INDEX IF NOT EXISTS posh_po_idx ON public.purchase_order_status_history(purchase_order_id, changed_at DESC);

-- Colonnes snapshot et clôture écart
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shop_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS supplier_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS lines_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS variance_reason TEXT,
  ADD COLUMN IF NOT EXISTS variance_note TEXT,
  ADD COLUMN IF NOT EXISTS variance_closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variance_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_note_reference TEXT;

-- Colonnes qualité réception sur les lignes
ALTER TABLE public.purchase_order_lines
  ADD COLUMN IF NOT EXISTS damaged_quantity NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reception_notes TEXT;

-- Trigger log de status
CREATE OR REPLACE FUNCTION public.po_log_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.purchase_order_status_history(shop_id, purchase_order_id, old_status, new_status, changed_by)
      VALUES (NEW.shop_id, NEW.id, NULL, NEW.status, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.purchase_order_status_history(shop_id, purchase_order_id, old_status, new_status, reason, note, changed_by)
      VALUES (NEW.shop_id, NEW.id, OLD.status, NEW.status,
              CASE WHEN NEW.status = 'closed_variance' THEN NEW.variance_reason END,
              CASE WHEN NEW.status = 'closed_variance' THEN NEW.variance_note END,
              auth.uid());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS po_status_log ON public.purchase_orders;
CREATE TRIGGER po_status_log
  AFTER INSERT OR UPDATE OF status ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.po_log_status_change();

-- RPC : envoyer un bon (fige snapshot)
CREATE OR REPLACE FUNCTION public.send_purchase_order(_po_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _po public.purchase_orders;
  _shop_snap JSONB;
  _sup_snap JSONB;
  _lines_snap JSONB;
BEGIN
  SELECT * INTO _po FROM public.purchase_orders WHERE id = _po_id FOR UPDATE;
  IF _po IS NULL THEN RAISE EXCEPTION 'purchase order not found'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _po.shop_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _po.status NOT IN ('draft') THEN RAISE EXCEPTION 'only draft orders can be sent'; END IF;

  PERFORM public.recompute_purchase_order_totals(_po_id);

  SELECT to_jsonb(s) INTO _shop_snap FROM (
    SELECT id, name, legal_name, address_line1, address_line2, postal_code, city, country,
           phone, email, siret, vat_number, logo_url
    FROM public.shops WHERE id = _po.shop_id
  ) s;
  SELECT to_jsonb(sp) INTO _sup_snap FROM (
    SELECT id, name, contact_name, phone, email, address_line1, address_line2,
           postal_code, city, country, vat_number, payment_terms, lead_time_days, notes
    FROM public.suppliers WHERE id = _po.supplier_id
  ) sp;
  SELECT jsonb_agg(to_jsonb(l) ORDER BY l.line_order) INTO _lines_snap FROM (
    SELECT l.*, si.name AS item_name, si.sku AS item_sku
    FROM public.purchase_order_lines l
    LEFT JOIN public.stock_items si ON si.id = l.item_id
    WHERE l.purchase_order_id = _po_id
  ) l;

  UPDATE public.purchase_orders
    SET status = 'sent',
        sent_at = now(),
        shop_snapshot = _shop_snap,
        supplier_snapshot = _sup_snap,
        lines_snapshot = _lines_snap
    WHERE id = _po_id;
END; $$;

-- RPC : clôturer avec écart
CREATE OR REPLACE FUNCTION public.close_purchase_order_variance(_po_id UUID, _reason TEXT, _note TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _po public.purchase_orders;
BEGIN
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'reason required'; END IF;
  SELECT * INTO _po FROM public.purchase_orders WHERE id = _po_id FOR UPDATE;
  IF _po IS NULL THEN RAISE EXCEPTION 'purchase order not found'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _po.shop_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _po.status NOT IN ('sent','confirmed','partial','late') THEN
    RAISE EXCEPTION 'cannot close order with status %', _po.status;
  END IF;
  UPDATE public.purchase_orders
    SET status = 'closed_variance',
        variance_reason = _reason,
        variance_note = _note,
        variance_closed_by = auth.uid(),
        variance_closed_at = now()
    WHERE id = _po_id;
END; $$;

-- Étend receive_purchase_order_line : refus si clôturée (statut ajouté)
CREATE OR REPLACE FUNCTION public.receive_purchase_order_line(
  _shop_id UUID, _line_id UUID, _quantity NUMERIC,
  _note TEXT DEFAULT NULL,
  _damaged NUMERIC DEFAULT 0,
  _delivery_note TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_line public.purchase_order_lines;
  v_po public.purchase_orders;
  v_all_received boolean;
  v_any_received boolean;
  v_supplier_id UUID;
  v_existing public.stock_item_suppliers;
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0'; END IF;
  IF _damaged IS NULL OR _damaged < 0 THEN _damaged := 0; END IF;

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

  IF v_line.item_id IS NOT NULL AND (_quantity - _damaged) > 0 THEN
    PERFORM public.apply_stock_movement(
      _shop_id, v_line.item_id, 'in'::public.stock_movement_kind,
      (_quantity - _damaged), 'réception commande',
      'purchase_order', v_line.purchase_order_id, _note
    );
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
        damaged_quantity = damaged_quantity + _damaged,
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

-- RPC statistiques fournisseur
CREATE OR REPLACE FUNCTION public.supplier_stats(_supplier_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _shop UUID;
  _total_cents BIGINT := 0;
  _month_cents BIGINT := 0;
  _year_cents BIGINT := 0;
  _order_count INT := 0;
  _received_count INT := 0;
  _partial_count INT := 0;
  _variance_count INT := 0;
  _late_count INT := 0;
  _avg_lead NUMERIC := NULL;
  _avg_delay NUMERIC := NULL;
  _late_rate NUMERIC := NULL;
  _full_rate NUMERIC := NULL;
  _reliability TEXT := 'insufficient_data';
BEGIN
  SELECT shop_id INTO _shop FROM public.suppliers WHERE id = _supplier_id;
  IF _shop IS NULL THEN RAISE EXCEPTION 'supplier not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) AND NOT public.is_admin_bpei(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT
    COALESCE(SUM(total_ttc_cents) FILTER (WHERE status <> 'draft' AND status <> 'cancelled'), 0),
    COALESCE(SUM(total_ttc_cents) FILTER (WHERE status <> 'draft' AND status <> 'cancelled'
      AND order_date >= date_trunc('month', now())), 0),
    COALESCE(SUM(total_ttc_cents) FILTER (WHERE status <> 'draft' AND status <> 'cancelled'
      AND order_date >= date_trunc('year', now())), 0),
    COUNT(*) FILTER (WHERE status NOT IN ('draft')),
    COUNT(*) FILTER (WHERE status = 'received'),
    COUNT(*) FILTER (WHERE status = 'partial'),
    COUNT(*) FILTER (WHERE status = 'closed_variance'),
    COUNT(*) FILTER (WHERE status = 'received' AND expected_date IS NOT NULL
      AND received_date > expected_date),
    AVG(CASE WHEN status = 'received' AND sent_at IS NOT NULL
             THEN EXTRACT(EPOCH FROM (received_date::timestamptz - sent_at))/86400 END),
    AVG(CASE WHEN status = 'received' AND expected_date IS NOT NULL AND received_date > expected_date
             THEN (received_date - expected_date)::numeric END)
  INTO _total_cents, _month_cents, _year_cents, _order_count, _received_count,
       _partial_count, _variance_count, _late_count, _avg_lead, _avg_delay
  FROM public.purchase_orders WHERE supplier_id = _supplier_id;

  IF _order_count > 0 THEN
    _late_rate := ROUND((_late_count::numeric / GREATEST(_received_count, 1)) * 100, 1);
    _full_rate := ROUND((_received_count::numeric / _order_count) * 100, 1);
  END IF;

  IF _order_count >= 5 THEN
    IF COALESCE(_late_rate, 0) <= 10 AND COALESCE(_full_rate, 0) >= 90 THEN _reliability := 'reliable';
    ELSIF COALESCE(_late_rate, 0) <= 25 THEN _reliability := 'generally_reliable';
    ELSE _reliability := 'to_watch';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'total_cents', _total_cents,
    'month_cents', _month_cents,
    'year_cents', _year_cents,
    'order_count', _order_count,
    'received_count', _received_count,
    'partial_count', _partial_count,
    'variance_count', _variance_count,
    'late_count', _late_count,
    'avg_lead_days', COALESCE(ROUND(_avg_lead::numeric, 1), NULL),
    'avg_delay_days', COALESCE(ROUND(_avg_delay::numeric, 1), NULL),
    'late_rate_pct', _late_rate,
    'full_rate_pct', _full_rate,
    'reliability', _reliability
  );
END $$;

-- Index ciblés
CREATE INDEX IF NOT EXISTS stock_movements_item_date_idx ON public.stock_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS po_shop_status_idx ON public.purchase_orders(shop_id, status);
CREATE INDEX IF NOT EXISTS pol_po_idx ON public.purchase_order_lines(purchase_order_id);

REVOKE EXECUTE ON FUNCTION public.send_purchase_order(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.close_purchase_order_variance(UUID, TEXT, TEXT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.supplier_stats(UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.send_purchase_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_purchase_order_variance(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_stats(UUID) TO authenticated;