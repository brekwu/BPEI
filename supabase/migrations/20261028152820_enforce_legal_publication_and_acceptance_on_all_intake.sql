DROP POLICY IF EXISTS application_insert_self ON public.independent_applications;
CREATE POLICY application_insert_self ON public.independent_applications FOR INSERT TO authenticated
 WITH CHECK(
  user_id=(SELECT auth.uid()) AND status='pending' AND reviewed_at IS NULL
  AND EXISTS(
    SELECT 1 FROM public.bpei_launch_controls c
    JOIN public.bpei_legal_acceptances acc ON acc.user_id=(SELECT auth.uid()) AND acc.legal_version=c.legal_version
    WHERE c.legal_documents_published=true
  )
 );
DROP POLICY IF EXISTS bpei_inquiries_create_if_open ON public.bpei_inquiries;
CREATE POLICY bpei_inquiries_create_if_open ON public.bpei_inquiries FOR INSERT TO anon,authenticated
 WITH CHECK(
  status='new' AND assigned_to IS NULL AND consent_accepted=true
  AND EXISTS(SELECT 1 FROM public.bpei_intake_flags f WHERE f.kind=bpei_inquiries.kind AND f.enabled=true)
  AND EXISTS(SELECT 1 FROM public.bpei_launch_controls c WHERE c.legal_documents_published=true)
 );
