-- Applied to project qmbsfmcotnsxsvbigynz on 2026-10-28 as migration 20261028170430.
-- An assigned mission must only be accepted or started while the professional is
-- actually approved, legal terms current and RC Pro insurance current.
-- Completing already in-progress work remains permitted for proper closure.
CREATE OR REPLACE FUNCTION bpei_private.can_accept_or_start_mission(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT EXISTS(
   SELECT 1 FROM public.independent_profiles p
   JOIN public.independent_applications a ON a.user_id=p.user_id AND a.status='approved'
   JOIN public.independent_verification_checks v ON v.user_id=p.user_id AND v.siret=p.siret
   JOIN auth.users u ON u.id=p.user_id AND u.email_confirmed_at IS NOT NULL
   JOIN public.bpei_legal_acceptances acc ON acc.user_id=p.user_id
   JOIN public.bpei_launch_controls ctrl ON ctrl.id=true
     AND ctrl.legal_documents_published IS TRUE
     AND ctrl.legal_version=acc.legal_version
   WHERE p.user_id=p_user_id AND p.verified_at IS NOT NULL
     AND v.enterprise_active IS TRUE AND v.establishment_active IS TRUE
     AND v.identity_confirmed IS TRUE
     AND v.insurance_confirmed IS TRUE AND v.insurance_expires_on >= current_date
     AND length(btrim(coalesce(v.insurance_evidence_reference,''))) BETWEEN 20 AND 700
     AND v.checked_at >= now()-interval '30 days'
 );
$function$
;
REVOKE ALL ON FUNCTION bpei_private.can_accept_or_start_mission(uuid)
 FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION bpei_private.respond_independent_request(p_request_id uuid, p_response text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 DECLARE v_request public.independent_requests%ROWTYPE;
 BEGIN
   IF auth.uid() IS NULL OR p_response NOT IN ('accepted','declined') THEN
      RAISE EXCEPTION 'Invalid response or not authenticated' USING ERRCODE='42501';
   END IF;
   SELECT * INTO v_request FROM public.independent_requests
    WHERE id=p_request_id FOR UPDATE;
   IF NOT FOUND OR v_request.independent_id<>auth.uid() OR v_request.status<>'new' THEN
      RAISE EXCEPTION 'Mission unavailable' USING ERRCODE='42501';
   END IF;
   IF p_response='accepted' AND NOT bpei_private.can_accept_or_start_mission((SELECT auth.uid())) THEN
      RAISE EXCEPTION 'Current professional verification, RC Pro and legal acknowledgement are required to accept a mission'
      USING ERRCODE='22023';
   END IF;
   UPDATE public.independent_requests
    SET status=CASE WHEN p_response='accepted' THEN 'accepted' ELSE 'cancelled' END,updated_at=now()
    WHERE id=p_request_id;
   IF p_response='declined' AND v_request.inquiry_id IS NOT NULL THEN
     UPDATE public.bpei_inquiries SET status='new',assigned_to=NULL,updated_at=now()
       WHERE id=v_request.inquiry_id;
   END IF;
   RETURN p_response;
 END
 $function$
;
CREATE OR REPLACE FUNCTION bpei_private.advance_independent_request(p_request_id uuid, p_next_status text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_request public.independent_requests%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_request FROM public.independent_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.independent_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Mission unavailable' USING ERRCODE='42501';
  END IF;
  IF NOT (
    (v_request.status='accepted' AND p_next_status='in_progress') OR
    (v_request.status='in_progress' AND p_next_status='completed')
  ) THEN
    RAISE EXCEPTION 'Invalid mission status transition' USING ERRCODE='22023';
  END IF;
  IF v_request.status='accepted' AND p_next_status='in_progress'
     AND NOT bpei_private.can_accept_or_start_mission((SELECT auth.uid())) THEN
     RAISE EXCEPTION 'Verification and valid RC Pro are required to start intervention' USING ERRCODE='22023';
  END IF;
  UPDATE public.independent_requests
   SET status=p_next_status, updated_at=now()
   WHERE id=p_request_id;
  RETURN p_next_status;
END;
$function$
;
