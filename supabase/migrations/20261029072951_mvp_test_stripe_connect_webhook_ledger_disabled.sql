-- MVP Stripe Connect foundation: test-only, fail-closed, no payment execution until
-- credentials, connected independent account and explicit gates are configured.
CREATE TABLE public.bpei_payment_controls(
 id boolean PRIMARY KEY DEFAULT true CHECK(id=true),
 test_checkout_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.bpei_payment_controls(id,test_checkout_enabled) VALUES(true,false);
ALTER TABLE public.bpei_payment_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_payment_controls FROM PUBLIC,anon,authenticated;

CREATE TABLE public.bpei_stripe_connected_accounts(
 issuer_id uuid PRIMARY KEY REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 stripe_account_id text NOT NULL UNIQUE CHECK(stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
 test_verified_at timestamptz,
 test_enabled boolean NOT NULL DEFAULT false,
 CHECK (NOT test_enabled OR test_verified_at IS NOT NULL)
);
ALTER TABLE public.bpei_stripe_connected_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_stripe_connected_accounts FROM PUBLIC,anon,authenticated;

CREATE TABLE public.bpei_payment_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id uuid NOT NULL REFERENCES public.bpei_service_invoices(id) ON DELETE RESTRICT,
 issuer_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 connected_account_id text NOT NULL CHECK(connected_account_id ~ '^acct_[A-Za-z0-9]+$'),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 100 AND 99999999),
 currency text NOT NULL DEFAULT 'eur' CHECK(currency='eur'),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','open','paid','failed','expired')),
 checkout_session_id text UNIQUE CHECK(checkout_session_id IS NULL OR checkout_session_id ~ '^cs_test_[A-Za-z0-9_]+$'),
 stripe_payment_intent_id text CHECK(stripe_payment_intent_id IS NULL OR stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 CHECK ((state='pending' AND checkout_session_id IS NULL AND paid_at IS NULL)
 OR (state='failed' AND paid_at IS NULL)
 OR (state IN ('open','expired') AND checkout_session_id IS NOT NULL AND paid_at IS NULL)
 OR (state='paid' AND checkout_session_id IS NOT NULL AND paid_at IS NOT NULL))
);
CREATE UNIQUE INDEX bpei_payment_one_live_attempt_per_invoice_idx
 ON public.bpei_payment_attempts(invoice_id) WHERE state IN ('pending','open','paid');
CREATE INDEX bpei_payment_attempts_issuer_idx
 ON public.bpei_payment_attempts(issuer_id,created_at DESC);
ALTER TABLE public.bpei_payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_payment_attempts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_payment_attempts TO authenticated;
CREATE POLICY bpei_payment_attempt_authorized_read
 ON public.bpei_payment_attempts FOR SELECT TO authenticated
 USING(issuer_id=(SELECT auth.uid()) OR EXISTS (
 SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid())
 ));

CREATE TABLE public.bpei_payment_webhook_events(
 event_id text PRIMARY KEY CHECK(event_id ~ '^evt_[A-Za-z0-9_]+$'),
 attempt_id uuid NOT NULL REFERENCES public.bpei_payment_attempts(id) ON DELETE RESTRICT,
 event_kind text NOT NULL CHECK(event_kind IN ('paid','failed','expired')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bpei_payment_events_attempt_idx
 ON public.bpei_payment_webhook_events(attempt_id);
ALTER TABLE public.bpei_payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_payment_webhook_events FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION bpei_private.mvp_test_checkout_prepare(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_invoice record; v_attempt uuid; v_allowed boolean;
BEGIN
 IF (SELECT auth.role())<>'service_role' THEN
  RAISE EXCEPTION 'Server service role required' USING ERRCODE='42501'; END IF;
 SELECT test_checkout_enabled INTO v_allowed FROM public.bpei_payment_controls WHERE id=true;
 IF v_allowed IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'BPEI test checkout is disabled' USING ERRCODE='42501'; END IF;
 SELECT i.id AS invoice_id,i.issuer_id,q.gross_cents,q.customer_email,
 q.service_description,m.stripe_account_id INTO v_invoice
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
 INSERT INTO public.bpei_payment_attempts(invoice_id,issuer_id,connected_account_id,amount_cents)
 VALUES(p_invoice_id,v_invoice.issuer_id,v_invoice.stripe_account_id,v_invoice.gross_cents)
 RETURNING id INTO v_attempt;
 RETURN jsonb_build_object('attempt_id',v_attempt,'account_id',v_invoice.stripe_account_id,
  'amount_cents',v_invoice.gross_cents,'email',v_invoice.customer_email,
  'description',v_invoice.service_description);
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_test_checkout_prepare(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_test_checkout_prepare(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.mvp_test_checkout_prepare(p_invoice_id uuid)
 RETURNS jsonb LANGUAGE sql SET search_path='' AS $$
 SELECT bpei_private.mvp_test_checkout_prepare($1) $$;
REVOKE ALL ON FUNCTION public.mvp_test_checkout_prepare(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_test_checkout_prepare(uuid) TO service_role;

CREATE OR REPLACE FUNCTION bpei_private.mvp_test_checkout_attach(p_attempt_id uuid,p_session_id text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (SELECT auth.role())<>'service_role' THEN
  RAISE EXCEPTION 'Server service role required' USING ERRCODE='42501'; END IF;
 IF p_session_id !~ '^cs_test_[A-Za-z0-9_]+$' THEN
  RAISE EXCEPTION 'Only test sessions allowed' USING ERRCODE='22023'; END IF;
 UPDATE public.bpei_payment_attempts SET
 state='open',checkout_session_id=p_session_id,updated_at=now()
 WHERE id=p_attempt_id AND state='pending' AND checkout_session_id IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt unavailable' USING ERRCODE='22023'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_test_checkout_attach(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_test_checkout_attach(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.mvp_test_checkout_attach(p_attempt_id uuid,p_session_id text)
 RETURNS boolean LANGUAGE sql SET search_path='' AS $$
 SELECT bpei_private.mvp_test_checkout_attach($1,$2) $$;
REVOKE ALL ON FUNCTION public.mvp_test_checkout_attach(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_test_checkout_attach(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION bpei_private.mvp_test_checkout_abort(p_attempt_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (SELECT auth.role())<>'service_role' THEN
  RAISE EXCEPTION 'Server service role required' USING ERRCODE='42501'; END IF;
 UPDATE public.bpei_payment_attempts SET state='failed',updated_at=now()
 WHERE id=p_attempt_id AND state='pending';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_test_checkout_abort(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_test_checkout_abort(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.mvp_test_checkout_abort(p_attempt_id uuid)
 RETURNS boolean LANGUAGE sql SET search_path='' AS $$
 SELECT bpei_private.mvp_test_checkout_abort($1) $$;
REVOKE ALL ON FUNCTION public.mvp_test_checkout_abort(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_test_checkout_abort(uuid) TO service_role;

CREATE OR REPLACE FUNCTION bpei_private.mvp_test_checkout_webhook(
 p_event_id text,p_attempt_id uuid,p_session_id text,p_account_id text,
 p_amount_cents bigint,p_currency text,p_intent_id text,p_kind text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_attempt public.bpei_payment_attempts%ROWTYPE;
BEGIN
 IF (SELECT auth.role())<>'service_role' THEN
  RAISE EXCEPTION 'Server service role required' USING ERRCODE='42501'; END IF;
 IF p_event_id !~ '^evt_[A-Za-z0-9_]+$' OR p_kind NOT IN ('paid','failed','expired')
 THEN RAISE EXCEPTION 'Unsupported webhook' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_attempt FROM public.bpei_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR v_attempt.checkout_session_id IS DISTINCT FROM p_session_id
 OR v_attempt.connected_account_id IS DISTINCT FROM p_account_id
 OR v_attempt.amount_cents IS DISTINCT FROM p_amount_cents
 OR p_currency<>'eur' OR v_attempt.currency<>'eur'
 THEN RAISE EXCEPTION 'Payment session, amount or merchant mismatch' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_payment_webhook_events WHERE event_id=p_event_id)
 THEN RETURN false; END IF;
 IF v_attempt.state='paid' OR v_attempt.state IN ('failed','expired')
 THEN RAISE EXCEPTION 'Payment attempt already terminal' USING ERRCODE='22023'; END IF;
 IF v_attempt.state<>'open' THEN
  RAISE EXCEPTION 'Payment session not yet attached; retry webhook' USING ERRCODE='40001'; END IF;
 IF p_kind='paid' AND (p_intent_id IS NULL OR p_intent_id !~ '^pi_[A-Za-z0-9_]+$')
 THEN RAISE EXCEPTION 'Confirmed payment intent required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_payment_webhook_events(event_id,attempt_id,event_kind)
 VALUES(p_event_id,p_attempt_id,p_kind);
 UPDATE public.bpei_payment_attempts
 SET state=CASE WHEN p_kind='paid' THEN 'paid' WHEN p_kind='expired' THEN 'expired' ELSE 'failed' END,
 stripe_payment_intent_id=CASE WHEN p_kind='paid' THEN p_intent_id ELSE stripe_payment_intent_id END,
 paid_at=CASE WHEN p_kind='paid' THEN now() ELSE NULL END,
 updated_at=now() WHERE id=p_attempt_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_test_checkout_webhook(text,uuid,text,text,bigint,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_test_checkout_webhook(text,uuid,text,text,bigint,text,text,text)
 TO service_role;
CREATE OR REPLACE FUNCTION public.mvp_test_checkout_webhook(
 p_event_id text,p_attempt_id uuid,p_session_id text,p_account_id text,
 p_amount_cents bigint,p_currency text,p_intent_id text,p_kind text
) RETURNS boolean LANGUAGE sql SET search_path='' AS $$
 SELECT bpei_private.mvp_test_checkout_webhook($1,$2,$3,$4,$5,$6,$7,$8) $$;
REVOKE ALL ON FUNCTION public.mvp_test_checkout_webhook(text,uuid,text,text,bigint,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_test_checkout_webhook(text,uuid,text,text,bigint,text,text,text)
 TO service_role;
