-- P0 BPEI: zero-persistence authorization verification.
-- Run on qmbsfmcotnsxsvbigynz only. All synthetic users/changes are rolled back.
-- Simulated JWT identities verify database RLS, NOT end-to-end GoTrue or SMTP.
BEGIN;
SET LOCAL ROLE anon;
DO $check$
DECLARE blocked boolean:=false;
BEGIN
 IF (SELECT count(*) FROM public.bpei_launch_controls
     WHERE id=true AND independent_registration_enabled=false
       AND legal_documents_published=false)<>1
 THEN RAISE EXCEPTION 'P0 failure: expected closed registration and legal gates'; END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_intake_flags WHERE enabled)
 THEN RAISE EXCEPTION 'P0 failure: customer intake is unexpectedly open'; END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_legal_documents)
 THEN RAISE EXCEPTION 'P0 failure: anonymous visitor can read legal drafts'; END IF;
 BEGIN
  INSERT INTO public.bpei_inquiries(kind,client_name,email,subject,description,consent_accepted)
  VALUES('contact','P0 Negative Check','probe@example.invalid','Authorization test',
         'This request must fail while the customer intake remains closed',true);
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'P0 failure: anonymous inquiry accepted'; END IF;
 blocked:=false;
 BEGIN PERFORM user_id FROM public.independent_admins LIMIT 1;
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'P0 failure: anonymous admin roster readable'; END IF;
END $check$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
SET LOCAL ROLE authenticated;
DO $check$
DECLARE blocked boolean;
BEGIN
 IF EXISTS(SELECT 1 FROM public.independent_admins) OR
    EXISTS(SELECT 1 FROM public.independent_profiles) OR
    EXISTS(SELECT 1 FROM public.independent_applications) OR
    EXISTS(SELECT 1 FROM public.bpei_legal_acceptances)
 THEN RAISE EXCEPTION 'P0 failure: unrelated personal data visible to nonadmin'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.approve_bpei_legal_document('mentions-legales','fake-p0-check',
       repeat('Unauthorized legal draft ',15));
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'P0 failure: nonadmin approved legal document'; END IF;
 blocked:=false;
 BEGIN PERFORM public.publish_bpei_legal_documents('fake-p0-check');
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'P0 failure: nonadmin published legal document'; END IF;
 blocked:=false;
 BEGIN
  PERFORM public.review_independent_application(
     'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,'approved');
 EXCEPTION WHEN OTHERS THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'P0 failure: nonadmin reviewed application'; END IF;
END $check$;
ROLLBACK;

BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,email_confirmed_at)
VALUES
 ('b0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bpei-p0-admin@example.invalid','{}','{}',now(),now(),now()),
 ('b0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bpei-p0-tech-a@example.invalid','{}','{}',now(),now(),now()),
 ('b0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bpei-p0-tech-b@example.invalid','{}','{}',now(),now(),now());
INSERT INTO public.independent_admins(user_id) VALUES('b0000000-0000-4000-8000-000000000001');
INSERT INTO public.independent_profiles(user_id,display_name) VALUES
 ('b0000000-0000-4000-8000-000000000002','P0 Technician A'),
 ('b0000000-0000-4000-8000-000000000003','P0 Technician B');
-- An approved but NOT published document must remain private.
INSERT INTO public.bpei_legal_documents(kind,version,content,approved_at,approved_by)
VALUES('mentions-legales','p0-unpublished-fixture',
       repeat('Temporary unapproved-for-publication legal test. ',10),
       now(),'b0000000-0000-4000-8000-000000000001');
SET LOCAL ROLE anon;
DO $draft$
BEGIN
 IF EXISTS(SELECT 1 FROM public.bpei_legal_documents WHERE version='p0-unpublished-fixture')
 THEN RAISE EXCEPTION 'P0 RLS: unpublished draft exposed to anonymous visitor'; END IF;
END $draft$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.independent_profiles)<>1 OR
    (SELECT display_name FROM public.independent_profiles LIMIT 1)<>'P0 Technician A'
 THEN RAISE EXCEPTION 'P0 failure: technician A visibility not isolated'; END IF;
 IF EXISTS(SELECT 1 FROM public.independent_admins)
 THEN RAISE EXCEPTION 'P0 failure: technician A can read admin roster'; END IF;
END $check$;
UPDATE public.independent_profiles SET display_name='P0 Technician A Updated'
 WHERE user_id='b0000000-0000-4000-8000-000000000002';
DO $check$
BEGIN
 IF (SELECT display_name FROM public.independent_profiles LIMIT 1)<>'P0 Technician A Updated'
 THEN RAISE EXCEPTION 'P0 failure: technician A cannot update own display name'; END IF;
END $check$;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000003',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.independent_profiles)<>1 OR
    (SELECT display_name FROM public.independent_profiles LIMIT 1)<>'P0 Technician B'
 THEN RAISE EXCEPTION 'P0 failure: technician B visibility not isolated'; END IF;
END $check$;
SELECT set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
DO $check$
BEGIN
 IF (SELECT count(*) FROM public.independent_profiles)<>2 OR
    (SELECT count(*) FROM public.independent_admins)<>1
 THEN RAISE EXCEPTION 'P0 failure: admin cannot read two profiles and admin roster'; END IF;
 IF (SELECT count(*) FROM public.bpei_legal_documents WHERE version='p0-unpublished-fixture')<>1
 THEN RAISE EXCEPTION 'P0 failure: administrator cannot review unpublished draft'; END IF;
END $check$;
ROLLBACK;
