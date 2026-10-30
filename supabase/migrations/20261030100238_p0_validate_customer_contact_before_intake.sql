-- Validate recorded customer contacts server-side, including direct RPC calls.
-- PostgreSQL owner can invoke the private routine; no Data API grants.
CREATE OR REPLACE FUNCTION bpei_private.valid_customer_contact(p_email text,p_phone text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $contact$
 SELECT coalesce(
  char_length(btrim(p_email)) BETWEEN 5 AND 254
  AND btrim(p_email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  AND strpos(btrim(p_email),'..')=0
  AND left(btrim(p_email),1)<>'.'
  AND split_part(btrim(p_email),'@',1) NOT LIKE '%.'
  AND split_part(btrim(p_email),'@',2) NOT LIKE '.%'
  AND right(btrim(p_email),1)<>'.'
  AND char_length(regexp_replace(btrim(p_phone),'[^0-9]','','g')) BETWEEN 6 AND 15
  AND btrim(p_phone) ~ '^\+?[0-9() ./-]+$',
  false
 );
$contact$;
REVOKE ALL ON FUNCTION bpei_private.valid_customer_contact(text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION bpei_private.mvp_admin_create_inquiry(p_client_name text, p_email text, p_phone text, p_city text, p_address_line1 text, p_postal_code text, p_customer_kind text, p_company_name text, p_company_siret text, p_subject text, p_description text, p_source text, p_privacy_ack_confirmed boolean, p_privacy_ack_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=(SELECT auth.uid());v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.independent_admins a WHERE a.user_id=v_actor
 ) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.bpei_launch_controls c WHERE c.id=true
    AND c.legal_documents_published=true AND c.legal_version IS NOT NULL
 ) THEN RAISE EXCEPTION 'Legal publication required before client intake'
 USING ERRCODE='42501'; END IF;
 IF p_privacy_ack_confirmed IS DISTINCT FROM true
 OR p_source NOT IN ('phone','email','in_person')
 OR char_length(btrim(coalesce(p_privacy_ack_reference,''))) NOT BETWEEN 12 AND 300
 THEN RAISE EXCEPTION 'Documented privacy acknowledgement required' USING ERRCODE='22023'; END IF;
 IF char_length(btrim(coalesce(p_client_name,''))) NOT BETWEEN 2 AND 120
 OR bpei_private.valid_customer_contact(p_email,p_phone) IS DISTINCT FROM TRUE
 OR char_length(btrim(coalesce(p_phone,''))) NOT BETWEEN 6 AND 40
 OR char_length(btrim(coalesce(p_city,''))) NOT BETWEEN 2 AND 120
 OR char_length(btrim(coalesce(p_address_line1,''))) NOT BETWEEN 5 AND 200
 OR coalesce(p_postal_code,'') !~ '^[0-9]{5}$'
 OR p_customer_kind NOT IN ('individual','business')
 OR (p_customer_kind='business' AND char_length(btrim(coalesce(p_company_name,''))) NOT BETWEEN 2 AND 160)
 OR (nullif(btrim(coalesce(p_company_siret,'')),'') IS NOT NULL AND btrim(p_company_siret) !~ '^[0-9]{14}$')
 OR char_length(btrim(coalesce(p_subject,''))) NOT BETWEEN 3 AND 160
 OR char_length(btrim(coalesce(p_description,''))) NOT BETWEEN 15 AND 3000
 THEN RAISE EXCEPTION 'Invalid client intervention details' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_inquiries(
  kind,client_name,email,phone,city,address_line1,postal_code,customer_kind,
  company_name,company_siret,subject,description,consent_accepted
 ) VALUES(
  'intervention',btrim(p_client_name),lower(btrim(p_email)),btrim(p_phone),
  btrim(p_city),btrim(p_address_line1),btrim(p_postal_code),p_customer_kind,
  CASE WHEN p_customer_kind='business' THEN btrim(p_company_name) ELSE NULL END,
  nullif(btrim(coalesce(p_company_siret,'')),''),
  btrim(p_subject),btrim(p_description),true
 ) RETURNING id INTO v_id;
 INSERT INTO public.bpei_private_intake_evidence(inquiry_id,recorded_by,source,privacy_ack_reference)
 VALUES(v_id,v_actor,p_source,btrim(p_privacy_ack_reference));
 RETURN v_id;
END $function$
;
