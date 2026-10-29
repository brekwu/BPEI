-- BPEI commissions for direct Stripe Connect TEST charges. Disabled at 0 by default.
-- A positive fee is only possible after the specific connected technician's documented agreement.
ALTER TABLE public.bpei_stripe_connected_accounts
 ADD COLUMN test_application_fee_bps integer NOT NULL DEFAULT 0 CHECK (test_application_fee_bps BETWEEN 0 AND 2500),
 ADD COLUMN fee_agreement_reference text,
 ADD COLUMN fee_agreement_at timestamptz,
 ADD CONSTRAINT bpei_agreed_connect_commission_only CHECK (
  test_application_fee_bps=0 OR (
   test_enabled=true AND test_verified_at IS NOT NULL
   AND fee_agreement_at IS NOT NULL
   AND char_length(btrim(coalesce(fee_agreement_reference,''))) BETWEEN 12 AND 300
  )
 );
ALTER TABLE public.bpei_payment_attempts
 ADD COLUMN application_fee_cents bigint NOT NULL DEFAULT 0,
 ADD CONSTRAINT bpei_fee_cannot_exceed_25_percent CHECK(
  application_fee_cents>=0 AND application_fee_cents<=amount_cents
  AND application_fee_cents<=((amount_cents*2500+5000)/10000)
 );

CREATE OR REPLACE FUNCTION bpei_private.mvp_test_checkout_prepare(p_invoice_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_invoice record; v_attempt uuid; v_allowed boolean; v_fee bigint;
BEGIN
 IF (SELECT auth.role())<>'service_role' THEN
  RAISE EXCEPTION 'Server service role required' USING ERRCODE='42501'; END IF;
 SELECT test_checkout_enabled INTO v_allowed FROM public.bpei_payment_controls WHERE id=true;
 IF v_allowed IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'BPEI test checkout is disabled' USING ERRCODE='42501'; END IF;
 SELECT i.id AS invoice_id,i.issuer_id,q.gross_cents,q.customer_email,
 q.service_description,m.stripe_account_id,m.test_application_fee_bps,
 m.fee_agreement_reference,m.fee_agreement_at INTO v_invoice
 FROM public.bpei_service_invoices i
 JOIN public.bpei_service_quotes q ON q.id=i.quote_id AND q.issuer_id=i.issuer_id
 JOIN public.bpei_stripe_connected_accounts m ON m.issuer_id=i.issuer_id
 WHERE i.id=p_invoice_id AND q.status='accepted' AND i.payment_status='unpaid'
 AND m.test_enabled=true AND m.test_verified_at IS NOT NULL
 FOR UPDATE OF i;
 IF NOT FOUND OR v_invoice.gross_cents NOT BETWEEN 100 AND 99999999 THEN
  RAISE EXCEPTION 'Invoice or verified connected merchant unavailable' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_payment_attempts WHERE invoice_id=p_invoice_id
  AND state IN ('pending','open','paid')) THEN
  RAISE EXCEPTION 'Payment attempt already active or paid' USING ERRCODE='23505'; END IF;
 IF v_invoice.test_application_fee_bps>0 AND (
  v_invoice.fee_agreement_at IS NULL OR
  char_length(btrim(coalesce(v_invoice.fee_agreement_reference,'')))<12
 ) THEN RAISE EXCEPTION 'Documented independent commission agreement required' USING ERRCODE='22023'; END IF;
 -- Integer arithmetic with explicit half-up rounding. The client cannot alter fees.
 v_fee:=((v_invoice.gross_cents::bigint*v_invoice.test_application_fee_bps::bigint)+5000)/10000;
 IF v_fee>v_invoice.gross_cents OR v_fee<0 THEN
  RAISE EXCEPTION 'Invalid platform fee' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_payment_attempts(
  invoice_id,issuer_id,connected_account_id,amount_cents,application_fee_cents
 ) VALUES(
  p_invoice_id,v_invoice.issuer_id,v_invoice.stripe_account_id,
  v_invoice.gross_cents,v_fee
 ) RETURNING id INTO v_attempt;
 RETURN jsonb_build_object(
  'attempt_id',v_attempt,'account_id',v_invoice.stripe_account_id,
  'amount_cents',v_invoice.gross_cents,'application_fee_cents',v_fee,
  'email',v_invoice.customer_email,'description',v_invoice.service_description
 );
END $$;
