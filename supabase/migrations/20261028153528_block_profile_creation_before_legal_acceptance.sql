DROP POLICY IF EXISTS independent_profile_insert_self ON public.independent_profiles;
CREATE POLICY independent_profile_insert_self ON public.independent_profiles
 FOR INSERT TO authenticated WITH CHECK(
 user_id=(SELECT auth.uid()) AND verified_at IS NULL
 AND EXISTS(
  SELECT 1 FROM public.bpei_launch_controls c
  JOIN public.bpei_legal_acceptances a
    ON a.user_id=(SELECT auth.uid()) AND a.legal_version=c.legal_version
  WHERE c.legal_documents_published=true
 )
);
