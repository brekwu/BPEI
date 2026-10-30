-- BPEI P0: evidence-backed readiness board. Read-only diagnostic never activates public signup,
-- test payments, mail delivery or legal publication. External provider checks require real evidence.
CREATE TABLE public.bpei_p0_attestations(
 check_key text PRIMARY KEY CHECK(check_key IN (
  'smtp_auth_delivery','commercial_sender_receipt','legal_operator_review',
  'partner_commission_signed','e_invoice_platform_receipt','stripe_test_payment',
  'full_pilot_verified'
 )),
 evidence_reference text NOT NULL CHECK(char_length(btrim(evidence_reference)) BETWEEN 30 AND 500),
 verified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bpei_p0_attestations_reviewer_idx ON public.bpei_p0_attestations(verified_by);
ALTER TABLE public.bpei_p0_attestations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_p0_attestations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_p0_attestations TO authenticated;
CREATE POLICY bpei_p0_attestations_admin_read ON public.bpei_p0_attestations
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid())
 ));

CREATE FUNCTION bpei_private.record_p0_attestation(
 p_check_key text,p_evidence_reference text,p_passed boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.independent_admins a
  JOIN auth.users u ON u.id=a.user_id
  WHERE a.user_id=v_actor AND u.email_confirmed_at IS NOT NULL
   AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
 ) THEN RAISE EXCEPTION 'Confirmed BPEI administrator required' USING ERRCODE='42501'; END IF;
 IF p_check_key NOT IN (
 'smtp_auth_delivery','commercial_sender_receipt','legal_operator_review',
 'partner_commission_signed','e_invoice_platform_receipt','stripe_test_payment',
 'full_pilot_verified'
 ) OR p_passed IS NULL THEN
  RAISE EXCEPTION 'Invalid P0 check' USING ERRCODE='22023'; END IF;
 IF p_passed=false THEN
  DELETE FROM public.bpei_p0_attestations WHERE check_key=p_check_key;
  RETURN true;
 END IF;
 IF char_length(btrim(coalesce(p_evidence_reference,''))) NOT BETWEEN 30 AND 500
  OR position('placeholder' in lower(p_evidence_reference))>0
  OR position('à compléter' in lower(p_evidence_reference))>0
  OR position('test à faire' in lower(p_evidence_reference))>0
 THEN RAISE EXCEPTION 'Detailed real evidence reference required; no placeholders'
  USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_p0_attestations(check_key,evidence_reference,verified_by,verified_at)
 VALUES(p_check_key,btrim(p_evidence_reference),v_actor,now())
 ON CONFLICT(check_key) DO UPDATE SET
 evidence_reference=EXCLUDED.evidence_reference,verified_by=EXCLUDED.verified_by,
 verified_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.record_p0_attestation(text,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.record_p0_attestation(text,text,boolean)
 TO authenticated;
CREATE FUNCTION public.record_p0_attestation(
 p_check_key text,p_evidence_reference text,p_passed boolean
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.record_p0_attestation($1,$2,$3)
$$;
REVOKE ALL ON FUNCTION public.record_p0_attestation(text,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_p0_attestation(text,text,boolean)
 TO authenticated;

CREATE FUNCTION bpei_private.p0_readiness() RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_actor uuid:=(SELECT auth.uid());
 v_admins int;
 v_users int;
 v_merchants int;
 v_sent int;
 v_paid int;
 v_accepted_quotes int;
 v_invoices int;
 v_legal boolean;
 v_mail boolean;
 v_sender boolean;
 v_payments boolean;
 v_flags jsonb;
 v_summary jsonb;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.independent_admins a
  JOIN auth.users u ON u.id=a.user_id
  WHERE a.user_id=v_actor AND u.email_confirmed_at IS NOT NULL
   AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
 ) THEN RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501'; END IF;

 SELECT count(*) INTO v_admins FROM public.independent_admins a
 JOIN auth.users u ON u.id=a.user_id
 WHERE u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
 AND u.is_anonymous IS NOT TRUE;
 SELECT count(*) INTO v_users FROM auth.users u
 WHERE u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
 AND u.is_anonymous IS NOT TRUE;
 SELECT count(*) INTO v_merchants FROM public.bpei_stripe_connected_accounts
 WHERE test_enabled=true AND test_verified_at IS NOT NULL;
 SELECT count(*) INTO v_sent FROM public.bpei_commercial_mail_outbox WHERE status='sent';
 SELECT count(*) INTO v_paid FROM public.bpei_payment_attempts WHERE state='paid';
 SELECT count(*) INTO v_accepted_quotes FROM public.bpei_service_quotes WHERE status='accepted';
 SELECT count(*) INTO v_invoices FROM public.bpei_service_invoices;
 SELECT legal_documents_published INTO v_legal FROM public.bpei_launch_controls WHERE id=true;
 SELECT enabled,validated_legal_sender INTO v_mail,v_sender FROM public.bpei_commercial_mail_controls WHERE id=true;
 SELECT test_checkout_enabled INTO v_payments FROM public.bpei_payment_controls WHERE id=true;

 SELECT coalesce(jsonb_object_agg(check_key,jsonb_build_object(
  'reference',evidence_reference,'verified_at',verified_at,'verified_by',verified_by
 )),'{}'::jsonb) INTO v_flags FROM public.bpei_p0_attestations;

 v_summary:=jsonb_build_object(
  'admin_account',jsonb_build_object('ready',v_admins>0,'verified_accounts',v_admins),
  'smtp_auth',jsonb_build_object('ready',v_flags ? 'smtp_auth_delivery',
   'evidence',v_flags->'smtp_auth_delivery','verification','manual'),
  'legal',jsonb_build_object('ready',v_legal IS TRUE AND v_flags ? 'legal_operator_review',
   'published',coalesce(v_legal,false),'evidence',v_flags->'legal_operator_review','verification','manual_and_database'),
  'commercial_email',jsonb_build_object('ready',v_mail IS TRUE AND v_sender IS TRUE
    AND v_sent>0 AND v_flags ? 'commercial_sender_receipt',
   'outbox_provider_accepted',v_sent,'evidence',v_flags->'commercial_sender_receipt'),
  'commission_and_einvoice',jsonb_build_object('ready',
    v_flags ? 'partner_commission_signed' AND v_flags ? 'e_invoice_platform_receipt',
    'commission_reference',v_flags->'partner_commission_signed',
    'e_invoice_reference',v_flags->'e_invoice_platform_receipt',
    'verification','manual'),
  'stripe_test',jsonb_build_object('ready',v_payments IS TRUE AND v_merchants>0
    AND v_paid>0 AND v_flags ? 'stripe_test_payment',
   'active_test_merchants',v_merchants,'paid_test_attempts',v_paid,
   'evidence',v_flags->'stripe_test_payment'),
  'pilot_e2e',jsonb_build_object('ready',v_users>=2 AND v_accepted_quotes>0
    AND v_invoices>0 AND v_paid>0 AND v_flags ? 'full_pilot_verified',
    'verified_users',v_users,'accepted_quotes',v_accepted_quotes,
    'invoices',v_invoices,'evidence',v_flags->'full_pilot_verified')
 );
 RETURN jsonb_build_object(
  'mode','preproduction','checked_at',now(),
  'checks',v_summary,
  'all_ready',(SELECT bool_and(coalesce((value->>'ready')::boolean,false))
      FROM pg_catalog.jsonb_each(v_summary))
 );
END $$;
REVOKE ALL ON FUNCTION bpei_private.p0_readiness() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.p0_readiness() TO authenticated;
CREATE FUNCTION public.p0_readiness() RETURNS jsonb LANGUAGE sql
 SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.p0_readiness()
$$;
REVOKE ALL ON FUNCTION public.p0_readiness() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.p0_readiness() TO authenticated;
