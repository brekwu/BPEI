-- Already applied to the BPEI Supabase project on 2026-10-28.
-- The Auth Hook must ALSO be enabled in the Supabase Authentication dashboard.
-- app_metadata is managed by the Auth Admin API; never use user_metadata for authorization.
CREATE OR REPLACE FUNCTION bpei_private.before_bpei_user_created(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE registration_open boolean;
BEGIN
  -- First administrator provisioning is permitted while signups remain closed.
  -- This marker does NOT grant admin privileges. Independent admin authorization
  -- requires a separate record in public.independent_admins.
  IF event->'user'->'app_metadata'->>'bpei_admin_bootstrap' = 'true' THEN
    RETURN '{}'::jsonb;
  END IF;
  SELECT (c.legal_documents_published IS TRUE
          AND c.independent_registration_enabled IS TRUE
          AND c.legal_version IS NOT NULL
          AND length(btrim(c.legal_version)) >= 3)
    INTO registration_open
  FROM public.bpei_launch_controls c WHERE c.id IS TRUE;
  IF registration_open IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('error',jsonb_build_object(
      'http_code',403,'message','BPEI registrations are not open'));
  END IF;
  RETURN '{}'::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION bpei_private.before_bpei_user_created(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.before_bpei_user_created(jsonb) TO supabase_auth_admin;
