CREATE POLICY independent_requests_admin_read ON public.independent_requests
 FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
 );
