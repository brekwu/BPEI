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
