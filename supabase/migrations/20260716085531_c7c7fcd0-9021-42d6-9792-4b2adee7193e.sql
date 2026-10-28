REVOKE SELECT ON public.reviews FROM anon;
GRANT SELECT (id, shop_id, rating, title, comment, author_name, status, published_at,
              reply_text, replied_at, rating_quality, rating_speed, rating_communication, created_at)
  ON public.reviews TO anon;

REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, name, legal_name, legal_form, siren, siret, vat_number, address, city, postal_code,
              phone, email, website, description, status, created_at, updated_at, validated_at)
  ON public.shops TO anon;

REVOKE SELECT ON public.service_catalog FROM anon;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'service_catalog'
     AND column_name NOT IN ('internal_reference', 'created_by');
  EXECUTE format('GRANT SELECT (%s) ON public.service_catalog TO anon', cols);
END $$;

DROP POLICY IF EXISTS "public can submit contact" ON public.contact_submissions;
DROP POLICY IF EXISTS "authenticated can submit contact" ON public.contact_submissions;
CREATE POLICY "public can submit contact" ON public.contact_submissions
  FOR INSERT TO anon
  WITH CHECK (consent = true
              AND char_length(message) BETWEEN 1 AND 5000
              AND char_length(email) BETWEEN 3 AND 200
              AND status = 'nouvelle'
              AND internal_note IS NULL
              AND handled_by IS NULL
              AND handled_at IS NULL);
CREATE POLICY "authenticated can submit contact" ON public.contact_submissions
  FOR INSERT TO authenticated
  WITH CHECK (consent = true
              AND char_length(message) BETWEEN 1 AND 5000
              AND char_length(email) BETWEEN 3 AND 200
              AND status = 'nouvelle'
              AND internal_note IS NULL
              AND handled_by IS NULL
              AND handled_at IS NULL);

DROP POLICY IF EXISTS "public can submit demo" ON public.demo_requests;
DROP POLICY IF EXISTS "authenticated can submit demo" ON public.demo_requests;
CREATE POLICY "public can submit demo" ON public.demo_requests
  FOR INSERT TO anon
  WITH CHECK (consent = true
              AND char_length(email) BETWEEN 3 AND 200
              AND char_length(shop_name) BETWEEN 1 AND 200
              AND status = 'nouvelle'
              AND internal_note IS NULL
              AND handled_by IS NULL
              AND handled_at IS NULL);
CREATE POLICY "authenticated can submit demo" ON public.demo_requests
  FOR INSERT TO authenticated
  WITH CHECK (consent = true
              AND char_length(email) BETWEEN 3 AND 200
              AND char_length(shop_name) BETWEEN 1 AND 200
              AND status = 'nouvelle'
              AND internal_note IS NULL
              AND handled_by IS NULL
              AND handled_at IS NULL);

REVOKE EXECUTE ON FUNCTION public.quarantine_action(uuid, uuid, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order_line(uuid, uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order_line(uuid, uuid, numeric, text, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalc_order_totals(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumption_last_days(uuid, uuid, integer) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.enforce_po_line_supplier_consistency() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.order_items_recalc_trigger() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.po_log_status_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.stock_item_suppliers_track_price() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.admin_seed_demo_shop() FROM anon, PUBLIC;