-- Applied to BPEI Supabase on 2026-10-28. Insurance proof required before approvals and assignments.
ALTER TABLE public.independent_verification_checks
 ADD COLUMN IF NOT EXISTS insurance_confirmed boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS insurance_expires_on date,
 ADD COLUMN IF NOT EXISTS insurance_evidence_reference text;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bpei_insurance_evidence_guard') THEN
  ALTER TABLE public.independent_verification_checks
   ADD CONSTRAINT bpei_insurance_evidence_guard CHECK (
     insurance_confirmed IS FALSE OR
     (insurance_expires_on IS NOT NULL AND char_length(btrim(coalesce(insurance_evidence_reference,''))) BETWEEN 20 AND 700)
   );
 END IF;
END $$;
CREATE OR REPLACE FUNCTION bpei_private.record_independent_verification_with_insurance(p_user_id uuid, p_siret text, p_enterprise_active boolean, p_establishment_active boolean, p_identity_confirmed boolean, p_evidence_source text, p_evidence_reference text, p_insurance_evidence_reference text, p_insurance_expires_on date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_insurance_expires_on IS NULL OR p_insurance_expires_on < current_date
    OR char_length(btrim(coalesce(p_insurance_evidence_reference,''))) NOT BETWEEN 20 AND 700
 THEN
   RAISE EXCEPTION 'Valid and documented RC Pro insurance is required'
   USING ERRCODE='22023';
 END IF;
 PERFORM bpei_private.record_independent_verification(
   p_user_id,p_siret,p_enterprise_active,p_establishment_active,
   p_identity_confirmed,p_evidence_source,p_evidence_reference);
 UPDATE public.independent_verification_checks SET
   insurance_confirmed=true,
   insurance_expires_on=p_insurance_expires_on,
   insurance_evidence_reference=btrim(p_insurance_evidence_reference)
 WHERE user_id=p_user_id;
 RETURN jsonb_build_object('user_id',p_user_id,'verified_evidence_recorded',true,
                           'insurance_valid_until',p_insurance_expires_on);
END;
$function$
;
REVOKE ALL ON FUNCTION bpei_private.record_independent_verification_with_insurance(uuid,text,boolean,boolean,boolean,text,text,text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.record_independent_verification_with_insurance(uuid,text,boolean,boolean,boolean,text,text,text,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.record_independent_verification_with_insurance(p_user_id uuid, p_siret text, p_enterprise_active boolean, p_establishment_active boolean, p_identity_confirmed boolean, p_evidence_source text, p_evidence_reference text, p_insurance_evidence_reference text, p_insurance_expires_on date)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bpei_private.record_independent_verification_with_insurance(
 p_user_id,p_siret,p_enterprise_active,p_establishment_active,
 p_identity_confirmed,p_evidence_source,p_evidence_reference,
 p_insurance_evidence_reference,p_insurance_expires_on)
$function$
;
REVOKE ALL ON FUNCTION public.record_independent_verification_with_insurance(uuid,text,boolean,boolean,boolean,text,text,text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_independent_verification_with_insurance(uuid,text,boolean,boolean,boolean,text,text,text,date) TO authenticated;
REVOKE ALL ON FUNCTION public.record_independent_verification(uuid,text,boolean,boolean,boolean,text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION bpei_private.review_independent_application(p_application_id uuid, p_new_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_admin uuid:=(SELECT auth.uid());v_app record;v_profile record;
BEGIN
 IF v_admin IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_admin) THEN
  RAISE EXCEPTION 'Not authorized to review applications' USING ERRCODE='42501';
 END IF;
 IF p_new_status IS NULL OR p_new_status NOT IN ('under_review','approved','rejected') THEN
  RAISE EXCEPTION 'Invalid status' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_app FROM public.independent_applications WHERE id=p_application_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found' USING ERRCODE='P0002'; END IF;
 IF p_new_status='approved' THEN
  IF NOT EXISTS (
     SELECT 1 FROM public.bpei_launch_controls ctrl
     JOIN public.bpei_legal_acceptances acceptance
       ON acceptance.legal_version=ctrl.legal_version AND acceptance.user_id=v_app.user_id
     WHERE ctrl.id=true AND ctrl.legal_documents_published=true
  ) THEN
     RAISE EXCEPTION 'Candidate must accept current published BPEI legal version'
     USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_profile FROM public.independent_profiles
   WHERE user_id=v_app.user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.siret IS NULL OR v_profile.siret !~ '^[0-9]{14}$' THEN
    RAISE EXCEPTION 'A candidate SIRET is required' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.independent_verification_checks c
     WHERE c.user_id=v_app.user_id AND c.siret=v_profile.siret
     AND c.enterprise_active=true AND c.establishment_active=true AND c.identity_confirmed=true
     AND c.insurance_confirmed IS TRUE AND c.insurance_expires_on >= current_date
     AND char_length(btrim(coalesce(c.insurance_evidence_reference,''))) BETWEEN 20 AND 700
     AND c.checked_at >= now()-interval '30 days'
  ) THEN
    RAISE EXCEPTION 'Official registry, active business and candidate identity checks required before approval'
    USING ERRCODE='22023';
  END IF;
 END IF;
 UPDATE public.independent_applications SET status=p_new_status,reviewed_at=now(),reviewed_by=v_admin
 WHERE id=p_application_id;
 UPDATE public.independent_profiles SET
 verified_at=CASE WHEN p_new_status='approved' THEN now() ELSE NULL END, updated_at=now()
 WHERE user_id=v_app.user_id;
 RETURN jsonb_build_object('id',p_application_id,'status',p_new_status);
END;
$function$
;
CREATE OR REPLACE FUNCTION bpei_private.assign_bpei_inquiry(p_inquiry_id uuid, p_independent_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 DECLARE v_row public.bpei_inquiries%ROWTYPE; v_id uuid;
 BEGIN
   IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=auth.uid()) THEN
     RAISE EXCEPTION 'BPEI admin required' USING ERRCODE='42501';
   END IF;
   IF NOT EXISTS (
      SELECT 1 FROM public.independent_profiles p
      JOIN public.independent_applications a ON a.user_id=p.user_id
      WHERE p.user_id=p_independent_id AND p.verified_at IS NOT NULL AND a.status='approved'
    AND EXISTS (
      SELECT 1 FROM public.independent_verification_checks c
      WHERE c.user_id=p.user_id AND c.siret=p.siret
        AND c.enterprise_active IS TRUE AND c.establishment_active IS TRUE
        AND c.identity_confirmed IS TRUE AND c.insurance_confirmed IS TRUE
        AND c.insurance_expires_on >= current_date
        AND char_length(btrim(coalesce(c.insurance_evidence_reference,''))) BETWEEN 20 AND 700
        AND c.checked_at >= now()-interval '30 days'
    )
   ) THEN RAISE EXCEPTION 'Independent must be approved and verified' USING ERRCODE='22023';
   END IF;
   SELECT * INTO v_row FROM public.bpei_inquiries
    WHERE id=p_inquiry_id FOR UPDATE;
   IF NOT FOUND OR v_row.kind<>'intervention' OR v_row.status<>'new' THEN
      RAISE EXCEPTION 'Intervention request unavailable' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.independent_requests(independent_id,inquiry_id,title,description,status)
   VALUES(p_independent_id,p_inquiry_id,v_row.subject,concat_ws(' — ',v_row.city,v_row.description),'new')
   RETURNING id INTO v_id;
   UPDATE public.bpei_inquiries SET status='assigned',assigned_to=p_independent_id,updated_at=now()
    WHERE id=p_inquiry_id;
   RETURN v_id;
 END
 $function$
;
