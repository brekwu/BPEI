-- BPEI P0 signup/Auth protection smoke, executed by the trusted SQL Editor.
-- Read-only: no Auth users, invites, emails, sessions or roles are created.
-- This verifies the DATABASE function and grants, NOT whether Supabase hosted
-- Authentication > Hooks is configured to invoke it. Check the hosted UI.
BEGIN READ ONLY;
DO $verify$
DECLARE
  public_attempt jsonb;
  claimed_ack jsonb;
  fake_user_metadata_marker jsonb;
  authorized_bootstrap jsonb;
BEGIN
  public_attempt := bpei_private.before_bpei_user_created(
   '{"user":{"app_metadata":{},"user_metadata":{}}}'::jsonb);
  claimed_ack := bpei_private.before_bpei_user_created(
   '{"user":{"app_metadata":{},"user_metadata":{"bpei_legal_version_acknowledged":"bpei-2026-v1"}}}'::jsonb);
  fake_user_metadata_marker := bpei_private.before_bpei_user_created(
   '{"user":{"app_metadata":{},"user_metadata":{"bpei_admin_bootstrap":true}}}'::jsonb);
  authorized_bootstrap := bpei_private.before_bpei_user_created(
   '{"user":{"app_metadata":{"bpei_admin_bootstrap":true},"user_metadata":{}}}'::jsonb);

  IF public_attempt #>> '{error,http_code}' <> '403'
    OR claimed_ack #>> '{error,http_code}' <> '403'
    OR fake_user_metadata_marker #>> '{error,http_code}' <> '403'
    OR authorized_bootstrap <> '{}'::jsonb THEN
    RAISE EXCEPTION 'P0 Auth hook failed closed registration and privileged marker boundary';
  END IF;
  IF NOT has_schema_privilege('supabase_auth_admin','bpei_private','USAGE')
   OR NOT has_function_privilege('supabase_auth_admin','bpei_private.before_bpei_user_created(jsonb)','EXECUTE')
   OR has_function_privilege('anon','bpei_private.before_bpei_user_created(jsonb)','EXECUTE')
   OR has_function_privilege('authenticated','bpei_private.before_bpei_user_created(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'P0 Auth hook role grants unexpected';
  END IF;
END $verify$;
ROLLBACK;
