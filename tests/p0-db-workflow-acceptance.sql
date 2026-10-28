-- P0 SQL integration smoke against BPEI preproduction.
-- All synthetic identities, approvals, legal publications and applications are rolled back.
-- This verifies database RLS/RPC, not real GoTrue, SMTP or human legal approvals.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,email_confirmed_at)
VALUES
 ('c0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p0-admin@example.invalid','{}','{}',now(),now(),now()),
 ('c0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p0-tech@example.invalid','{}','{}',now(),now(),now()),
 ('c0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p0-other@example.invalid','{}','{}',now(),now(),now());
INSERT INTO public.independent_admins(user_id) VALUES('c0000000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $admin$
DECLARE txt text:=repeat('This synthetic test text is not an approved legal document. ',10);
BEGIN
 PERFORM public.approve_bpei_legal_document('mentions-legales','p0-acceptance-txn',txt);
 PERFORM public.approve_bpei_legal_document('confidentialite','p0-acceptance-txn',txt);
 PERFORM public.approve_bpei_legal_document('cgu','p0-acceptance-txn',txt);
 PERFORM public.publish_bpei_legal_documents('p0-acceptance-txn');
 IF NOT EXISTS(SELECT 1 FROM public.bpei_launch_controls WHERE legal_version='p0-acceptance-txn'
   AND legal_documents_published=true AND independent_registration_enabled=false)
 THEN RAISE EXCEPTION 'P0: legal publishing unexpectedly opened the portal'; END IF;
END $admin$;
SELECT set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000002',true);
INSERT INTO public.bpei_legal_acceptances(user_id,legal_version)
VALUES ('c0000000-0000-4000-8000-000000000002','p0-acceptance-txn');
INSERT INTO public.independent_profiles(user_id,display_name)
VALUES ('c0000000-0000-4000-8000-000000000002','P0 Test Technician');
INSERT INTO public.independent_applications(user_id,message)
VALUES ('c0000000-0000-4000-8000-000000000002','Temporary test application for the P0 approval workflow');
DO $tech$
DECLARE blocked boolean:=false;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.independent_applications WHERE user_id=(SELECT auth.uid()) AND status='pending')
 THEN RAISE EXCEPTION 'P0: technician cannot read own application'; END IF;
 BEGIN
  UPDATE public.independent_profiles SET verified_at=now()
    WHERE user_id='c0000000-0000-4000-8000-000000000002';
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'P0: technician can self-verify'; END IF;
END $tech$;
SELECT set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000003',true);
DO $other$
BEGIN
 IF EXISTS(SELECT 1 FROM public.independent_profiles) OR
    EXISTS(SELECT 1 FROM public.independent_applications) OR
    EXISTS(SELECT 1 FROM public.bpei_legal_acceptances)
 THEN RAISE EXCEPTION 'P0: another technician can read private records'; END IF;
END $other$;
SELECT set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
DO $review$
DECLARE result jsonb;
BEGIN
 SELECT public.review_independent_application(id,'under_review') INTO result
   FROM public.independent_applications
   WHERE user_id='c0000000-0000-4000-8000-000000000002';
 IF result->>'status' IS DISTINCT FROM 'under_review'
 THEN RAISE EXCEPTION 'P0: admin cannot review submitted application'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.independent_applications
   WHERE status='under_review' AND reviewed_by=(SELECT auth.uid()))
 THEN RAISE EXCEPTION 'P0: missing review audit'; END IF;
 IF EXISTS(SELECT 1 FROM public.independent_profiles WHERE verified_at IS NOT NULL)
 THEN RAISE EXCEPTION 'P0: profile verified without professional checks'; END IF;
END $review$;
ROLLBACK;