-- P0: a quoted intervention must have the same current professional eligibility
-- as a new assignment. Do not loosen the previously approved/insured criteria.
-- No user provisioning, legal publication, mail sending or payment activation.
CREATE OR REPLACE FUNCTION bpei_private.mvp_create_quote(p_inquiry_id uuid, p_issuer_legal_name text, p_issuer_address text, p_issuer_email text, p_tax_mention text, p_service_description text, p_quantity integer, p_unit_price_cents integer, p_vat_basis_points integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=(SELECT auth.uid()); v_inquiry public.bpei_inquiries%ROWTYPE;
v_issuer record; v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_inquiry FROM public.bpei_inquiries WHERE id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR v_inquiry.kind<>'intervention' OR v_inquiry.status<>'assigned'
    OR v_inquiry.assigned_to IS NULL OR v_inquiry.address_line1 IS NULL OR v_inquiry.postal_code IS NULL
 THEN RAISE EXCEPTION 'Assigned, complete intervention required' USING ERRCODE='22023'; END IF;
 SELECT p.user_id,p.siret,p.verified_at INTO v_issuer
 FROM public.independent_profiles p
 JOIN public.independent_applications a ON a.user_id=p.user_id AND a.status='approved'
 JOIN public.independent_verification_checks c ON c.user_id=p.user_id
   AND c.siret=p.siret
   AND c.enterprise_active IS TRUE AND c.establishment_active IS TRUE
   AND c.identity_confirmed IS TRUE
   AND c.insurance_confirmed IS TRUE AND c.insurance_expires_on>=current_date
   AND char_length(btrim(coalesce(c.insurance_evidence_reference,''))) BETWEEN 20 AND 700
   AND c.checked_at>=now()-interval '30 days'
 WHERE p.user_id=v_inquiry.assigned_to AND p.verified_at IS NOT NULL;
 IF NOT FOUND OR v_issuer.siret IS NULL THEN
  RAISE EXCEPTION 'Current enterprise, identity, SIRET and RC Pro verification required for quote'
   USING ERRCODE='22023'; END IF;
 IF p_quantity NOT BETWEEN 1 AND 100 OR p_unit_price_cents NOT BETWEEN 100 AND 20000000
 OR p_vat_basis_points NOT IN (0,210,550,1000,2000) THEN
  RAISE EXCEPTION 'Invalid quote amount or tax rate' USING ERRCODE='22023'; END IF;
 IF p_vat_basis_points=0 AND char_length(btrim(coalesce(p_tax_mention,''))) NOT BETWEEN 10 AND 200
 THEN RAISE EXCEPTION 'Validated tax-exemption legal mention required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_service_quotes(
 inquiry_id,issuer_id,created_by,issuer_legal_name,issuer_siret,issuer_address,issuer_email,tax_mention,
 customer_name,customer_email,customer_address,customer_kind,customer_siret,service_description,
 quantity,unit_price_cents,vat_basis_points
 ) VALUES(
 v_inquiry.id,v_inquiry.assigned_to,v_actor,btrim(p_issuer_legal_name),v_issuer.siret,
 btrim(p_issuer_address),btrim(p_issuer_email),btrim(coalesce(p_tax_mention,'')),
 CASE WHEN v_inquiry.customer_kind='business' THEN v_inquiry.company_name ELSE v_inquiry.client_name END,
 v_inquiry.email,concat_ws(', ',v_inquiry.address_line1,v_inquiry.postal_code,v_inquiry.city),
 v_inquiry.customer_kind,v_inquiry.company_siret,btrim(p_service_description),
 p_quantity,p_unit_price_cents,p_vat_basis_points
 ) RETURNING id INTO v_id;
 RETURN v_id;
END $function$
;
