-- Stripe Connect TEST-only refund and dispute monitoring. No bank movement.
-- Event must already have valid Stripe HMAC signature before any privileged RPC.
CREATE TABLE public.bpei_payment_refunds(
 stripe_refund_id text PRIMARY KEY CHECK(stripe_refund_id ~ '^re_[A-Za-z0-9_]+$'),
 attempt_id uuid NOT NULL REFERENCES public.bpei_payment_attempts(id) ON DELETE RESTRICT,
 amount_cents bigint NOT NULL CHECK(amount_cents>0),
 status text NOT NULL CHECK(status IN ('pending','succeeded','failed','canceled')),
 last_provider_created bigint NOT NULL CHECK(last_provider_created>=0),
 last_event_id text NOT NULL CHECK(last_event_id ~ '^evt_[A-Za-z0-9_]+$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bpei_payment_refunds_attempt_idx ON public.bpei_payment_refunds(attempt_id);
ALTER TABLE public.bpei_payment_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_payment_refunds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_payment_refunds TO authenticated;
CREATE POLICY bpei_payment_refunds_authorized_read ON public.bpei_payment_refunds
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.bpei_payment_attempts a WHERE a.id=attempt_id AND
   (a.issuer_id=(SELECT auth.uid()) OR EXISTS(
      SELECT 1 FROM public.independent_admins ad WHERE ad.user_id=(SELECT auth.uid())
   ))
 ));

CREATE TABLE public.bpei_payment_disputes(
 stripe_dispute_id text PRIMARY KEY CHECK(stripe_dispute_id ~ '^dp_[A-Za-z0-9_]+$'),
 attempt_id uuid NOT NULL REFERENCES public.bpei_payment_attempts(id) ON DELETE RESTRICT,
 disputed_cents bigint NOT NULL CHECK(disputed_cents>0),
 status text NOT NULL CHECK(status IN ('open','won','lost')),
 last_provider_created bigint NOT NULL CHECK(last_provider_created>=0),
 last_event_id text NOT NULL CHECK(last_event_id ~ '^evt_[A-Za-z0-9_]+$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bpei_payment_disputes_attempt_idx ON public.bpei_payment_disputes(attempt_id);
ALTER TABLE public.bpei_payment_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_payment_disputes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_payment_disputes TO authenticated;
CREATE POLICY bpei_payment_disputes_authorized_read ON public.bpei_payment_disputes
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.bpei_payment_attempts a WHERE a.id=attempt_id AND
   (a.issuer_id=(SELECT auth.uid()) OR EXISTS(
      SELECT 1 FROM public.independent_admins ad WHERE ad.user_id=(SELECT auth.uid())
   ))
 ));

CREATE TABLE public.bpei_payment_adjustment_events(
 event_id text PRIMARY KEY CHECK(event_id ~ '^evt_[A-Za-z0-9_]+$'),
 attempt_id uuid NOT NULL REFERENCES public.bpei_payment_attempts(id) ON DELETE RESTRICT,
 provider_object_id text NOT NULL CHECK(provider_object_id ~ '^(re|dp)_[A-Za-z0-9_]+$'),
 event_kind text NOT NULL CHECK(event_kind IN ('refund','dispute')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bpei_payment_adjustment_events_attempt_idx
 ON public.bpei_payment_adjustment_events(attempt_id);
ALTER TABLE public.bpei_payment_adjustment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_payment_adjustment_events FROM PUBLIC,anon,authenticated;
CREATE POLICY bpei_adjustment_events_private_read ON public.bpei_payment_adjustment_events
 FOR SELECT TO anon,authenticated USING(false);

CREATE OR REPLACE FUNCTION bpei_private.mvp_test_payment_adjustment_event(
 p_event_id text,p_attempt_id uuid,p_account_id text,p_payment_intent_id text,
 p_object_id text,p_kind text,p_status text,p_amount_cents bigint,p_provider_created bigint
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_attempt public.bpei_payment_attempts%ROWTYPE;
 v_existing_amount bigint; v_already_refunded bigint;
BEGIN
 IF (SELECT auth.role())<>'service_role' THEN
  RAISE EXCEPTION 'Server service role required' USING ERRCODE='42501'; END IF;
 IF p_event_id !~ '^evt_[A-Za-z0-9_]+$' OR p_kind NOT IN ('refund','dispute')
 OR p_provider_created IS NULL OR p_provider_created<0
 OR p_amount_cents IS NULL OR p_amount_cents<=0
 THEN RAISE EXCEPTION 'Invalid provider event' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_attempt FROM public.bpei_payment_attempts
  WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR v_attempt.state<>'paid' OR
   v_attempt.connected_account_id IS DISTINCT FROM p_account_id OR
   v_attempt.stripe_payment_intent_id IS DISTINCT FROM p_payment_intent_id OR
   p_amount_cents>v_attempt.amount_cents
 THEN RAISE EXCEPTION 'Payment intent, merchant or refund amount mismatch' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_payment_adjustment_events WHERE event_id=p_event_id)
 THEN RETURN false; END IF;
 IF p_kind='refund' THEN
  IF p_object_id !~ '^re_[A-Za-z0-9_]+$'
  OR p_status NOT IN ('pending','succeeded','failed','canceled')
  THEN RAISE EXCEPTION 'Invalid refund object' USING ERRCODE='22023'; END IF;
  SELECT amount_cents INTO v_existing_amount FROM public.bpei_payment_refunds
   WHERE stripe_refund_id=p_object_id;
  IF FOUND AND v_existing_amount<>p_amount_cents THEN
   RAISE EXCEPTION 'Refund amount changed for immutable provider ID' USING ERRCODE='22023'; END IF;
  -- Sum unique *successful* refunds rather than trusting cumulative increments.
  IF p_status='succeeded' THEN
   SELECT COALESCE(sum(r.amount_cents),0) INTO v_already_refunded
    FROM public.bpei_payment_refunds r
    WHERE r.attempt_id=p_attempt_id AND r.status='succeeded'
      AND r.stripe_refund_id<>p_object_id;
   IF v_already_refunded+p_amount_cents>v_attempt.amount_cents THEN
    RAISE EXCEPTION 'Refund total cannot exceed original payment' USING ERRCODE='22023'; END IF;
  END IF;
  INSERT INTO public.bpei_payment_refunds(
   stripe_refund_id,attempt_id,amount_cents,status,last_provider_created,last_event_id
  ) VALUES(p_object_id,p_attempt_id,p_amount_cents,p_status,p_provider_created,p_event_id)
  ON CONFLICT(stripe_refund_id) DO UPDATE SET
   status=EXCLUDED.status,last_provider_created=EXCLUDED.last_provider_created,
   last_event_id=EXCLUDED.last_event_id,updated_at=now()
  WHERE public.bpei_payment_refunds.attempt_id=EXCLUDED.attempt_id
    AND public.bpei_payment_refunds.last_provider_created<=EXCLUDED.last_provider_created
    AND public.bpei_payment_refunds.status<>'succeeded';
 ELSE
  IF p_object_id !~ '^dp_[A-Za-z0-9_]+$' OR p_status NOT IN ('open','won','lost')
  THEN RAISE EXCEPTION 'Invalid dispute object' USING ERRCODE='22023'; END IF;
  SELECT disputed_cents INTO v_existing_amount FROM public.bpei_payment_disputes
   WHERE stripe_dispute_id=p_object_id;
  IF FOUND AND v_existing_amount<>p_amount_cents THEN
   RAISE EXCEPTION 'Dispute amount changed for provider ID' USING ERRCODE='22023'; END IF;
  INSERT INTO public.bpei_payment_disputes(
    stripe_dispute_id,attempt_id,disputed_cents,status,last_provider_created,last_event_id
  ) VALUES(p_object_id,p_attempt_id,p_amount_cents,p_status,p_provider_created,p_event_id)
  ON CONFLICT(stripe_dispute_id) DO UPDATE SET
   status=EXCLUDED.status,last_provider_created=EXCLUDED.last_provider_created,
   last_event_id=EXCLUDED.last_event_id,updated_at=now()
  WHERE public.bpei_payment_disputes.attempt_id=EXCLUDED.attempt_id
    AND public.bpei_payment_disputes.last_provider_created<=EXCLUDED.last_provider_created
    AND public.bpei_payment_disputes.status='open';
 END IF;
 INSERT INTO public.bpei_payment_adjustment_events(event_id,attempt_id,provider_object_id,event_kind)
 VALUES(p_event_id,p_attempt_id,p_object_id,p_kind);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_test_payment_adjustment_event(text,uuid,text,text,text,text,text,bigint,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_test_payment_adjustment_event(text,uuid,text,text,text,text,text,bigint,bigint)
 TO service_role;

CREATE OR REPLACE FUNCTION public.mvp_test_payment_adjustment_event(
 p_event_id text,p_attempt_id uuid,p_account_id text,p_payment_intent_id text,
 p_object_id text,p_kind text,p_status text,p_amount_cents bigint,p_provider_created bigint
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.mvp_test_payment_adjustment_event($1,$2,$3,$4,$5,$6,$7,$8,$9)
$$;
REVOKE ALL ON FUNCTION public.mvp_test_payment_adjustment_event(text,uuid,text,text,text,text,text,bigint,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_test_payment_adjustment_event(text,uuid,text,text,text,text,text,bigint,bigint)
 TO service_role;
