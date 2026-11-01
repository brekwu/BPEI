ALTER TABLE public.bpei_inquiries
 ADD CONSTRAINT bpei_inquiries_email_format
 CHECK (email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 ADD CONSTRAINT bpei_intervention_city_required
 CHECK (kind <> 'intervention' OR (city IS NOT NULL AND char_length(btrim(city)) BETWEEN 2 AND 120));
CREATE INDEX IF NOT EXISTS independent_applications_reviewed_by_idx
 ON public.independent_applications(reviewed_by) WHERE reviewed_by IS NOT NULL;
DROP POLICY IF EXISTS application_select_self ON public.independent_applications;
DROP POLICY IF EXISTS independent_admin_read_applications ON public.independent_applications;
CREATE POLICY independent_application_self_or_admin_read ON public.independent_applications
 FOR SELECT TO authenticated USING (
   user_id = (SELECT auth.uid())
   OR EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
 );
DROP POLICY IF EXISTS independent_profile_read_self ON public.independent_profiles;
DROP POLICY IF EXISTS independent_admin_read_profiles ON public.independent_profiles;
CREATE POLICY independent_profile_self_or_admin_read ON public.independent_profiles
 FOR SELECT TO authenticated USING (
   user_id = (SELECT auth.uid())
   OR EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
 );
