DROP POLICY IF EXISTS bpei_inquiries_admin_read ON public.bpei_inquiries;
DROP POLICY IF EXISTS bpei_assigned_technician_can_read_accepted_client_contact ON public.bpei_inquiries;
CREATE POLICY bpei_inquiry_read_authorized ON public.bpei_inquiries
FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
 OR (
  kind='intervention' AND EXISTS (
   SELECT 1 FROM public.independent_requests r
    WHERE r.inquiry_id=bpei_inquiries.id
      AND r.independent_id=(SELECT auth.uid())
      AND r.status IN ('accepted','in_progress','completed')
  )
 )
);
DROP POLICY IF EXISTS independent_request_read_self ON public.independent_requests;
DROP POLICY IF EXISTS independent_requests_admin_read ON public.independent_requests;
CREATE POLICY independent_request_read_self_or_admin ON public.independent_requests
FOR SELECT TO authenticated USING (
 independent_id=(SELECT auth.uid())
 OR EXISTS (SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
);
