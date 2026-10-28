CREATE SCHEMA IF NOT EXISTS bpei_private;
REVOKE ALL ON SCHEMA bpei_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA bpei_private TO authenticated;
ALTER FUNCTION public.review_independent_application(uuid,text) SET SCHEMA bpei_private;
ALTER FUNCTION public.assign_bpei_inquiry(uuid,uuid) SET SCHEMA bpei_private;
ALTER FUNCTION public.close_bpei_inquiry(uuid) SET SCHEMA bpei_private;
ALTER FUNCTION public.respond_independent_request(uuid,text) SET SCHEMA bpei_private;
ALTER FUNCTION public.advance_independent_request(uuid,text) SET SCHEMA bpei_private;

CREATE FUNCTION public.review_independent_application(p_application_id uuid,p_new_status text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT bpei_private.review_independent_application(p_application_id,p_new_status) $$;
CREATE FUNCTION public.assign_bpei_inquiry(p_inquiry_id uuid,p_independent_id uuid)
RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT bpei_private.assign_bpei_inquiry(p_inquiry_id,p_independent_id) $$;
CREATE FUNCTION public.close_bpei_inquiry(p_inquiry_id uuid)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT bpei_private.close_bpei_inquiry(p_inquiry_id) $$;
CREATE FUNCTION public.respond_independent_request(p_request_id uuid,p_response text)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT bpei_private.respond_independent_request(p_request_id,p_response) $$;
CREATE FUNCTION public.advance_independent_request(p_request_id uuid,p_next_status text)
RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT bpei_private.advance_independent_request(p_request_id,p_next_status) $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bpei_private FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION bpei_private.review_independent_application(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.assign_bpei_inquiry(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.close_bpei_inquiry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.respond_independent_request(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.advance_independent_request(uuid,text) TO authenticated;

REVOKE ALL ON FUNCTION public.review_independent_application(uuid,text),
 public.assign_bpei_inquiry(uuid,uuid), public.close_bpei_inquiry(uuid),
 public.respond_independent_request(uuid,text), public.advance_independent_request(uuid,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_independent_application(uuid,text),
 public.assign_bpei_inquiry(uuid,uuid), public.close_bpei_inquiry(uuid),
 public.respond_independent_request(uuid,text), public.advance_independent_request(uuid,text)
 TO authenticated;
