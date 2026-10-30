-- Captured canonical function definition for migration already applied to preproduction.
-- Strict test-only financial reconciliation. LIVE flow remains absent.
CREATE OR REPLACE FUNCTION bpei_private.mvp_test_checkout_prepare(p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_invoice record;
 v_attempt uuid;
 v_allowed boolean;
 v_legal boolean;
 v_fee bigint;
BEGIN
 IF (SELECT auth.role()) <> 'service_role' THEN
  RAISE EXCEPTION 'Server service role required' USING ERRCODE='42501'; END IF;
 SELECT test_checkout_enabled INTO v_allowed FROM public.bpei_payment_controls WHERE id=true;
 SELECT legal_documents_published INTO v_legal FROM public.bpei_launch_controls WHERE id=true;
 IF v_allowed IS DISTINCT FROM true OR v_legal IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Stripe test checkout and reviewed legal documents must be enabled'
   USING ERRCODE='42501'; END IF;
 SELECT
  i.id AS invoice_id,i.issuer_id,q.gross_cents,q.net_cents,q.vat_basis_points,
  q.customer_email,q.service_description,q.status AS quote_status,
  m.stripe_account_id,m.test_application_fee_bps,
  m.fee_agreement_reference,m.fee_agreement_at,
  p.client_price_ht_cents,p.technician_ht_cents,p.bpei_ht_cents,
  p.status AS compensation_status,p.source AS client_source,
  p.contractual_reference,p.accepted_at AS compensation_accepted_at,
  r.id AS mission_id,r.status AS mission_status
 INTO v_invoice
 FROM public.bpei_service_invoices i
 JOIN public.bpei_service_quotes q
  ON q.id=i.quote_id AND q.issuer_id=i.issuer_id
 JOIN public.independent_requests r
  ON r.inquiry_id=q.inquiry_id AND r.independent_id=i.issuer_id
 JOIN public.bpei_partner_compensation_proposals p
  ON p.request_id=r.id AND p.partner_id=i.issuer_id
 JOIN public.bpei_stripe_connected_accounts m
  ON m.issuer_id=i.issuer_id
 WHERE i.id=p_invoice_id
  AND i.payment_status='unpaid'
  AND q.status='accepted'
  AND r.status='completed'
  AND p.status='accepted'
  AND p.accepted_at IS NOT NULL
  AND m.test_enabled=true
  AND m.test_verified_at IS NOT NULL
 FOR UPDATE OF i;
 IF NOT FOUND OR v_invoice.gross_cents NOT BETWEEN 100 AND 99999999 THEN
  RAISE EXCEPTION 'Invoice, completed mission, signed compensation or verified test merchant unavailable'
   USING ERRCODE='22023'; END IF;

 -- The quote is issued by the independent. Comparing HT figures alone to a
 -- commission on an amount containing VAT would misstate BPEI's taxable fee.
 -- Until BPEI's own commission VAT treatment is reviewed, explicitly reject
 -- VAT-bearing quotes in this direct-charge TEST route.
 IF v_invoice.vat_basis_points <> 0 OR v_invoice.net_cents <> v_invoice.gross_cents
 THEN
  RAISE EXCEPTION 'Commission VAT treatment unresolved; test Checkout closed for taxed invoices'
   USING ERRCODE='22023'; END IF;
 IF v_invoice.client_price_ht_cents::bigint <> v_invoice.net_cents
  OR v_invoice.technician_ht_cents::bigint+v_invoice.bpei_ht_cents::bigint<>v_invoice.net_cents
 THEN
  RAISE EXCEPTION 'Approved quote total differs from remuneration agreement'
   USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_payment_attempts
  WHERE invoice_id=p_invoice_id AND state IN ('pending','open','paid')) THEN
  RAISE EXCEPTION 'Payment attempt already active or paid' USING ERRCODE='23505'; END IF;
 IF v_invoice.bpei_ht_cents>0 AND (
  v_invoice.fee_agreement_at IS NULL
  OR char_length(btrim(coalesce(v_invoice.fee_agreement_reference,'')))<12
  OR v_invoice.test_application_fee_bps<=0
  OR position(btrim(v_invoice.fee_agreement_reference)
    IN btrim(v_invoice.contractual_reference))=0
 ) THEN
  RAISE EXCEPTION 'Signed platform commission and exact mission contract reference required'
   USING ERRCODE='22023'; END IF;
 IF v_invoice.bpei_ht_cents=0 AND v_invoice.test_application_fee_bps<>0 THEN
  RAISE EXCEPTION 'Uncontracted platform fee configured' USING ERRCODE='22023'; END IF;
 -- Cross-region referral commissions are not legal to pay or recognise
 -- before the referrer has explicitly accepted their separate agreement.
 IF v_invoice.client_source='referral' AND NOT EXISTS(
  SELECT 1 FROM public.bpei_partner_referral_agreements a
  WHERE a.request_id=v_invoice.mission_id
   AND a.performing_partner_id=v_invoice.issuer_id
   AND a.state='accepted'
 ) THEN
  RAISE EXCEPTION 'Referring partner contractual acceptance required'
   USING ERRCODE='22023'; END IF;
 v_fee:=((v_invoice.gross_cents::bigint
   *v_invoice.test_application_fee_bps::bigint)+5000)/10000;
 IF v_fee<>v_invoice.bpei_ht_cents
 OR v_fee>v_invoice.gross_cents OR v_fee<0
 OR v_fee>((v_invoice.gross_cents::bigint*2500+5000)/10000)
 THEN
  RAISE EXCEPTION 'Checkout fee and independent remuneration contract mismatch'
   USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_payment_attempts(
  invoice_id,issuer_id,connected_account_id,amount_cents,application_fee_cents
 ) VALUES(
  p_invoice_id,v_invoice.issuer_id,v_invoice.stripe_account_id,
  v_invoice.gross_cents,v_fee
 ) RETURNING id INTO v_attempt;
 RETURN jsonb_build_object(
  'attempt_id',v_attempt,'account_id',v_invoice.stripe_account_id,
  'amount_cents',v_invoice.gross_cents,
  'application_fee_cents',v_fee,
  'email',v_invoice.customer_email,
  'description',v_invoice.service_description
 );
END $function$
;
