-- Applied on Supabase BPEI on 2026-10-28.
-- Prevent direct Auth API signups that bypass the client-side legal checkbox.
CREATE OR REPLACE FUNCTION bpei_private.has_current_signup_acknowledgement(
  p_event jsonb,
  p_version text
) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=''
AS $$
 SELECT p_version IS NOT NULL
   AND length(btrim(p_version)) >= 3
   AND p_event->'user'->'user_metadata'->>'bpei_legal_version_acknowledged' = p_version;
$$;
REVOKE ALL ON FUNCTION bpei_private.has_current_signup_acknowledgement(jsonb,text)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION bpei_private.before_bpei_user_created(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $function$
DECLARE registration_open boolean; current_version text;
BEGIN
 IF event->'user'->'app_metadata'->>'bpei_admin_bootstrap' = 'true' THEN
   RETURN '{}'::jsonb;
 END IF;
 SELECT (c.legal_documents_published IS TRUE
   AND c.independent_registration_enabled IS TRUE
   AND c.legal_version IS NOT NULL
   AND length(btrim(c.legal_version))>=3), c.legal_version
 INTO registration_open,current_version
 FROM public.bpei_launch_controls c WHERE c.id IS TRUE;
 IF registration_open IS DISTINCT FROM TRUE THEN
   RETURN jsonb_build_object('error',jsonb_build_object(
     'http_code',403,'message','BPEI registrations are not open'));
 END IF;
 IF NOT bpei_private.has_current_signup_acknowledgement(event,current_version) THEN
   RETURN jsonb_build_object('error',jsonb_build_object(
     'http_code',403,'message','BPEI current legal version must be acknowledged'));
 END IF;
 RETURN '{}'::jsonb;
END;
$function$;
REVOKE ALL ON FUNCTION bpei_private.before_bpei_user_created(jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.before_bpei_user_created(jsonb)
 TO supabase_auth_admin;
