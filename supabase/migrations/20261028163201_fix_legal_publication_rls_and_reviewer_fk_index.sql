DROP POLICY IF EXISTS bpei_legal_public_view ON public.bpei_legal_documents;
DROP POLICY IF EXISTS bpei_legal_admin_read ON public.bpei_legal_documents;
CREATE POLICY bpei_legal_anonymous_published_read ON public.bpei_legal_documents
 FOR SELECT TO anon USING(
 EXISTS(SELECT 1 FROM public.bpei_launch_controls c
 WHERE c.legal_documents_published=true AND c.legal_version=bpei_legal_documents.version)
);
CREATE POLICY bpei_legal_authenticated_read ON public.bpei_legal_documents
 FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.bpei_launch_controls c
 WHERE c.legal_documents_published=true AND c.legal_version=bpei_legal_documents.version)
 OR EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
);
CREATE INDEX IF NOT EXISTS bpei_legal_releases_published_by_idx
 ON public.bpei_legal_releases(published_by);
