-- BPEI P0 fail-closed smoke. Transaction is read-only, never fabricates accounts.
BEGIN READ ONLY;

DO $check$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.bpei_legal_releases) AND EXISTS(
  SELECT 1 FROM public.bpei_launch_controls
  WHERE id=true AND (independent_registration_enabled=true OR legal_documents_published=true)
 ) THEN RAISE EXCEPTION 'FAIL: intake opened without any legally published version'; END IF;
 IF EXISTS (SELECT 1 FROM public.bpei_payment_controls
   WHERE id=true AND test_checkout_enabled=true)
 AND NOT EXISTS (SELECT 1 FROM public.independent_admins)
 THEN RAISE EXCEPTION 'FAIL: test payments opened without an administrator'; END IF;
 -- SQL editor runs as the privileged operator; this checks the hook's
 -- behavior but does not prove it is enabled in Supabase Auth Settings.
 result:=bpei_private.before_bpei_user_created(
  '{"user":{"email":"not-a-real-user@example.invalid",
    "user_metadata":{"bpei_legal_version_acknowledged":"fake-2026"}}}'::jsonb
 );
 IF result->'error'->>'http_code'<>'403'
 THEN RAISE EXCEPTION 'FAIL: Auth hook accepted a new user before launch'; END IF;
END $check$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
DO $check$
DECLARE erroneously_allowed boolean:=false;
BEGIN
 BEGIN PERFORM public.p0_readiness();erroneously_allowed:=true;
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF erroneously_allowed THEN RAISE EXCEPTION 'FAIL: ordinary user can read P0'; END IF;
 erroneously_allowed:=false;
 BEGIN
  PERFORM public.record_p0_attestation(
   'smtp_auth_delivery','Evidence without a real verified administrator should not pass',true
  );
  erroneously_allowed:=true;
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF erroneously_allowed THEN RAISE EXCEPTION 'FAIL: ordinary user can approve P0'; END IF;
END $check$;
ROLLBACK;
