CREATE FUNCTION bpei_private.before_bpei_user_created(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE registration_open boolean;
BEGIN
 SELECT (c.legal_documents_published=true AND c.independent_registration_enabled=true
     AND c.legal_version IS NOT NULL) INTO registration_open
 FROM public.bpei_launch_controls c WHERE c.id=true;
 IF registration_open IS DISTINCT FROM TRUE THEN
   RETURN jsonb_build_object('error',jsonb_build_object(
     'http_code',403,'message','BPEI registrations are not open'
   ));
 END IF;
 RETURN '{}'::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION bpei_private.before_bpei_user_created(jsonb) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA bpei_private TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION bpei_private.before_bpei_user_created(jsonb) TO supabase_auth_admin;
