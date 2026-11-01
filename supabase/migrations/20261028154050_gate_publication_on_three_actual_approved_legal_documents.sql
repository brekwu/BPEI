CREATE TABLE public.bpei_legal_documents(
 kind text NOT NULL CHECK(kind IN ('mentions-legales','confidentialite','cgu')),
 version text NOT NULL CHECK(char_length(version) BETWEEN 3 AND 90),
 content text NOT NULL CHECK(char_length(btrim(content)) BETWEEN 300 AND 50000),
 approved_at timestamptz NOT NULL,
 approved_by uuid NOT NULL REFERENCES auth.users(id),
 PRIMARY KEY(kind,version)
);
ALTER TABLE public.bpei_legal_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_legal_documents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_legal_documents TO anon,authenticated;
CREATE POLICY bpei_legal_public_view ON public.bpei_legal_documents FOR SELECT TO anon,authenticated
 USING(
   EXISTS(
    SELECT 1 FROM public.bpei_launch_controls c
    WHERE c.legal_documents_published=true AND c.legal_version=bpei_legal_documents.version
   )
 );
CREATE FUNCTION bpei_private.enforce_published_legal_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE missing_docs integer;
BEGIN
 IF NEW.legal_documents_published=true THEN
   IF NEW.legal_version IS NULL THEN
     RAISE EXCEPTION 'Missing legal document version' USING ERRCODE='22023';
   END IF;
   SELECT 3-count(DISTINCT d.kind) INTO missing_docs FROM public.bpei_legal_documents d
    JOIN public.independent_admins adm ON adm.user_id=d.approved_by
    WHERE d.version=NEW.legal_version AND d.approved_at IS NOT NULL
      AND d.kind IN ('mentions-legales','confidentialite','cgu');
   IF missing_docs<>0 THEN RAISE EXCEPTION 'Three approved legal documents required for publication' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bpei_private.enforce_published_legal_documents() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_require_real_documents_before_opening
 BEFORE INSERT OR UPDATE OF legal_documents_published, legal_version, independent_registration_enabled
 ON public.bpei_launch_controls
 FOR EACH ROW EXECUTE FUNCTION bpei_private.enforce_published_legal_documents();
