-- Rollback-only P0 personal contact authorization and legal-acceptance test.
-- All identities, personal data and legal versions are synthetic.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,email_confirmed_at)
VALUES
('e0000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p0-privacy-admin@example.invalid','{}','{}',now(),now(),now()),
('e0000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p0-privacy-tech-a@example.invalid','{}','{}',now(),now(),now()),
('e0000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','p0-privacy-tech-b@example.invalid','{}','{}',now(),now(),now());
INSERT INTO public.independent_admins(user_id) VALUES ('e0000000-0000-4000-8000-000000000001');
INSERT INTO public.independent_profiles(user_id,display_name) VALUES
('e0000000-0000-4000-8000-000000000002','P0 Privacy A'),
('e0000000-0000-4000-8000-000000000003','P0 Privacy B');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
DO $approve$
DECLARE d text:=repeat('Temporary text used exclusively for rollback testing. ',10);
BEGIN
 PERFORM public.approve_bpei_legal_document('mentions-legales','p0-privacy-rollback',d);
 PERFORM public.approve_bpei_legal_document('confidentialite','p0-privacy-rollback',d);
 PERFORM public.approve_bpei_legal_document('cgu','p0-privacy-rollback',d);
 PERFORM public.publish_bpei_legal_documents('p0-privacy-rollback');
 IF NOT EXISTS(SELECT 1 FROM public.bpei_launch_controls
   WHERE legal_version='p0-privacy-rollback' AND independent_registration_enabled=false)
 THEN RAISE EXCEPTION 'P0: new legal version unexpectedly opened signup'; END IF;
END $approve$;
RESET ROLE;
INSERT INTO public.bpei_inquiries(id,kind,client_name,email,city,subject,description,consent_accepted,status,assigned_to)
VALUES ('e0000000-0000-4000-8000-000000000010','intervention','P0 Fake Client',
 'p0-client@example.invalid','Nice','Fictional intervention',
 'Synthetic and non-personal description for testing customer data isolation.',true,'new',NULL),
('e0000000-0000-4000-8000-000000000011','contact','P0 Fake Contact',
 'p0-contact@example.invalid',NULL,'Fictional contact',
 'Synthetic text unrelated to any actual person or contact request.',true,'new',NULL);
DO $no_consent$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  INSERT INTO public.independent_requests(id,independent_id,title,status,inquiry_id)
  VALUES('e0000000-0000-4000-8000-000000000020',
    'e0000000-0000-4000-8000-000000000002','P0 Private Contact','new',
    'e0000000-0000-4000-8000-000000000010');
 EXCEPTION WHEN OTHERS THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'P0: assignment allowed without current legal consent'; END IF;
END $no_consent$;
INSERT INTO public.bpei_legal_acceptances(user_id,legal_version)
VALUES('e0000000-0000-4000-8000-000000000002','p0-privacy-rollback');
INSERT INTO public.independent_requests(id,independent_id,title,status,inquiry_id)
VALUES('e0000000-0000-4000-8000-000000000020',
  'e0000000-0000-4000-8000-000000000002','P0 Private Contact','new',
  'e0000000-0000-4000-8000-000000000010');
SET LOCAL ROLE anon;
DO $anonymous$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN PERFORM id FROM public.bpei_inquiries;
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'P0: anonymous visitor can read private customer data'; END IF;
END $anonymous$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $unaccepted$
BEGIN
 IF EXISTS(SELECT 1 FROM public.bpei_inquiries)
 THEN RAISE EXCEPTION 'P0: technician sees client contact before accepting mission'; END IF;
END $unaccepted$;
RESET ROLE;
UPDATE public.independent_requests SET status='accepted' WHERE id='e0000000-0000-4000-8000-000000000020';
SELECT set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $accepted$
BEGIN
 IF (SELECT count(*) FROM public.bpei_inquiries)<>1
 OR (SELECT email FROM public.bpei_inquiries LIMIT 1)<>'p0-client@example.invalid'
 THEN RAISE EXCEPTION 'P0: accepted technician client data scope is wrong'; END IF;
END $accepted$;
SELECT set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000003',true);
DO $other$
BEGIN
 IF EXISTS(SELECT 1 FROM public.bpei_inquiries)
 THEN RAISE EXCEPTION 'P0: foreign technician can view another assigned client'; END IF;
END $other$;
SELECT set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
DO $administrator$
BEGIN
 IF (SELECT count(*) FROM public.bpei_inquiries)<>2
 THEN RAISE EXCEPTION 'P0: admin cannot read all synthetic inquiries'; END IF;
END $administrator$;
RESET ROLE;
UPDATE public.independent_requests SET status='cancelled' WHERE id='e0000000-0000-4000-8000-000000000020';
SELECT set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
DO $cancelled$
BEGIN
 IF EXISTS(SELECT 1 FROM public.bpei_inquiries)
 THEN RAISE EXCEPTION 'P0: cancelled assignment still exposes customer'; END IF;
END $cancelled$;
ROLLBACK;