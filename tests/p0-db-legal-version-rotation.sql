-- P0 legal version rotation acceptance, no permanent data.
-- Every synthetic user, business record and publication is ROLLED BACK.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,email_confirmed_at)
VALUES
('d0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p0-legal-admin@example.invalid','{}','{}',now(),now(),now()),
('d0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p0-legal-tech@example.invalid','{}','{}',now(),now(),now());
INSERT INTO public.independent_admins(user_id) VALUES('d0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
DO $admin$
DECLARE txt text:=repeat('Synthetic draft for test only, never legal advice. ',10);denied boolean:=false;
BEGIN
 BEGIN PERFORM public.publish_bpei_legal_documents('p0-rotation-a');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'P0: empty legal release published'; END IF;
 PERFORM public.approve_bpei_legal_document('mentions-legales','p0-rotation-a',txt);
 PERFORM public.approve_bpei_legal_document('confidentialite','p0-rotation-a',txt);
 denied:=false;
 BEGIN PERFORM public.publish_bpei_legal_documents('p0-rotation-a');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'P0: incomplete legal release published'; END IF;
 PERFORM public.approve_bpei_legal_document('cgu','p0-rotation-a',txt);
 PERFORM public.publish_bpei_legal_documents('p0-rotation-a');
 IF NOT EXISTS (SELECT 1 FROM public.bpei_launch_controls
     WHERE id=true AND legal_version='p0-rotation-a' AND legal_documents_published=true
       AND independent_registration_enabled=false)
 THEN RAISE EXCEPTION 'P0: publication opened registration'; END IF;
 denied:=false;
 BEGIN PERFORM public.publish_bpei_legal_documents('p0-rotation-a');
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'P0: published version reused'; END IF;
 denied:=false;
 BEGIN PERFORM public.approve_bpei_legal_document('cgu','p0-rotation-a',repeat('Change ',50));
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'P0: published version modified'; END IF;
END $admin$;
SELECT set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
INSERT INTO public.bpei_legal_acceptances(user_id,legal_version)
 VALUES('d0000000-0000-4000-8000-000000000002','p0-rotation-a');
INSERT INTO public.independent_profiles(user_id,display_name,siret)
 VALUES('d0000000-0000-4000-8000-000000000002','P0 Legal version test','00000000000000');
INSERT INTO public.independent_applications(user_id,message)
 VALUES('d0000000-0000-4000-8000-000000000002','Synthetic application for legal version test');
SELECT set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
DO $new_release$
DECLARE txt text:=repeat('New synthetic version for test, never real legal advice. ',10);
BEGIN
 PERFORM public.record_independent_verification_with_insurance(
 'd0000000-0000-4000-8000-000000000002'::uuid,'00000000000000',
 true,true,true,'annuaire_entreprises',repeat('synthetic-registrar-evidence-',3),
 repeat('synthetic-insurance-evidence-',3),current_date+10);
 PERFORM public.approve_bpei_legal_document('mentions-legales','p0-rotation-b',txt);
 PERFORM public.approve_bpei_legal_document('confidentialite','p0-rotation-b',txt);
 PERFORM public.approve_bpei_legal_document('cgu','p0-rotation-b',txt);
 PERFORM public.publish_bpei_legal_documents('p0-rotation-b');
 IF NOT EXISTS(SELECT 1 FROM public.bpei_launch_controls
    WHERE id=true AND legal_version='p0-rotation-b' AND independent_registration_enabled=false)
 THEN RAISE EXCEPTION 'P0: second release state incorrect'; END IF;
END $new_release$;
DO $stale$
DECLARE denied boolean:=false;
BEGIN
 BEGIN
  PERFORM public.review_independent_application(id,'approved')
    FROM public.independent_applications
    WHERE user_id='d0000000-0000-4000-8000-000000000002';
 EXCEPTION WHEN OTHERS THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'P0: stale legal consent was accepted for approval'; END IF;
END $stale$;
SELECT set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
INSERT INTO public.bpei_legal_acceptances(user_id,legal_version)
VALUES('d0000000-0000-4000-8000-000000000002','p0-rotation-b');
SELECT set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
DO $latest$
DECLARE result jsonb;
BEGIN
 SELECT public.review_independent_application(id,'approved') INTO result
 FROM public.independent_applications
 WHERE user_id='d0000000-0000-4000-8000-000000000002';
 IF result->>'status' IS DISTINCT FROM 'approved'
 THEN RAISE EXCEPTION 'P0: newest legal consent not accepted'; END IF;
END $latest$;
ROLLBACK;