CREATE POLICY bpei_assigned_technician_can_read_accepted_client_contact
ON public.bpei_inquiries FOR SELECT TO authenticated
USING (
  kind='intervention'
  AND EXISTS (
    SELECT 1 FROM public.independent_requests r
    WHERE r.inquiry_id = bpei_inquiries.id
      AND r.independent_id=(SELECT auth.uid())
      AND r.status IN ('accepted','in_progress','completed')
  )
);
