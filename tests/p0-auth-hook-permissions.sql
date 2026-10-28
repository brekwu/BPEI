-- P0 verification of the existing Supabase Auth Before User Created hook.
-- Non-destructive database function checks. These do NOT prove that GoTrue
-- is configured to invoke the hook or that SMTP can deliver an email.
-- Run against the dedicated BPEI project only, using its SQL editor.
DO $p0$
DECLARE result jsonb;
BEGIN
  SELECT bpei_private.before_bpei_user_created(
    jsonb_build_object('user',jsonb_build_object('email','blocked@example.invalid',
      'user_metadata',jsonb_build_object('bpei_legal_version_acknowledged','fake-v1')))
  ) INTO result;
  IF result->'error'->>'http_code' <> '403' THEN
    RAISE EXCEPTION 'P0 FAIL: normal signup allowed with launch closed';
  END IF;
  SELECT bpei_private.before_bpei_user_created(
    jsonb_build_object('user',jsonb_build_object('email','bootstrap@example.invalid',
      'app_metadata',jsonb_build_object('bpei_admin_bootstrap',true)))
  ) INTO result;
  IF result <> '{}'::jsonb THEN
    RAISE EXCEPTION 'P0 FAIL: privileged bootstrap hook path denied';
  END IF;
  IF bpei_private.has_current_signup_acknowledgement('{}'::jsonb,'legal-v1') THEN
    RAISE EXCEPTION 'P0 FAIL: empty legal acknowledgement accepted';
  END IF;
  IF bpei_private.has_current_signup_acknowledgement(
    '{"user":{"user_metadata":{"bpei_legal_version_acknowledged":"old-v1"}}}'::jsonb,
    'legal-v1') THEN
    RAISE EXCEPTION 'P0 FAIL: outdated acknowledgement accepted';
  END IF;
  IF NOT bpei_private.has_current_signup_acknowledgement(
    '{"user":{"user_metadata":{"bpei_legal_version_acknowledged":"legal-v1"}}}'::jsonb,
    'legal-v1') THEN
    RAISE EXCEPTION 'P0 FAIL: valid acknowledgement rejected';
  END IF;
END $p0$;

SELECT has_schema_privilege('supabase_auth_admin','bpei_private','USAGE') AS hook_schema_usable,
       has_function_privilege('supabase_auth_admin','bpei_private.before_bpei_user_created(jsonb)','EXECUTE') AS hook_executable,
       has_function_privilege('anon','bpei_private.before_bpei_user_created(jsonb)','EXECUTE') AS anonymous_cannot_execute_directly;
