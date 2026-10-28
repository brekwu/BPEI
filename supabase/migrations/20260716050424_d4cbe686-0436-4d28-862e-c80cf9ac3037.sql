-- Vague 3 fix: send_purchase_order used non-existent column l.line_order (real column is position)
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
    SELECT id, name FROM public.shops WHERE id = _po.shop_id
  ) s;
  SELECT to_jsonb(sp) INTO _sup_snap FROM (
    SELECT id, name, contact_name, phone, email, address, vat_number, payment_terms, default_lead_days, notes
    FROM public.suppliers WHERE id = _po.supplier_id
  ) sp;
  SELECT jsonb_agg(to_jsonb(l) ORDER BY l.position) INTO _lines_snap FROM (
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