-- Keep SECURITY DEFINER code out of the public API schema.
ALTER FUNCTION public.mvp_admin_create_inquiry(text,text,text,text,text,text,text,text,text,text,text,text,boolean,text) SET SCHEMA bpei_private;
REVOKE ALL ON FUNCTION bpei_private.mvp_admin_create_inquiry(text,text,text,text,text,text,text,text,text,text,text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_admin_create_inquiry(text,text,text,text,text,text,text,text,text,text,text,text,boolean,text) TO authenticated;
CREATE FUNCTION public.mvp_admin_create_inquiry(p_client_name text,p_email text,p_phone text,p_city text,p_address_line1 text,p_postal_code text,p_customer_kind text,p_company_name text,p_company_siret text,p_subject text,p_description text,p_source text,p_privacy_ack_confirmed boolean,p_privacy_ack_reference text)
 RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  SELECT bpei_private.mvp_admin_create_inquiry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
 $$;
REVOKE ALL ON FUNCTION public.mvp_admin_create_inquiry(text,text,text,text,text,text,text,text,text,text,text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_admin_create_inquiry(text,text,text,text,text,text,text,text,text,text,text,text,boolean,text) TO authenticated;
