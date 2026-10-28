CREATE POLICY bpei_legal_admin_read ON public.bpei_legal_documents
 FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid())));

CREATE OR REPLACE FUNCTION bpei_private.approve_bpei_legal_document(
 p_kind text,p_version text,p_content text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE operator_id uuid := (SELECT auth.uid());
BEGIN
 IF operator_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=operator_id) THEN
   RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501';
 END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('mentions-legales','confidentialite','cgu')
 OR p_version IS NULL OR p_version !~ '^[a-zA-Z0-9._-]{3,90}$'
 OR p_content IS NULL OR length(btrim(p_content)) NOT BETWEEN 300 AND 50000 THEN
   RAISE EXCEPTION 'Invalid legal document data' USING ERRCODE='22023';
 END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_launch_controls
   WHERE legal_documents_published=true AND legal_version=p_version)
 THEN RAISE EXCEPTION 'Cannot modify a published legal version' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_legal_documents(kind,version,content,approved_at,approved_by)
 VALUES (p_kind,p_version,btrim(p_content),now(),operator_id)
 ON CONFLICT(kind,version) DO UPDATE SET
  content=excluded.content,approved_at=now(),approved_by=operator_id;
 RETURN jsonb_build_object('kind',p_kind,'version',p_version,'approved',true);
END; $$;
REVOKE ALL ON FUNCTION bpei_private.approve_bpei_legal_document(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.approve_bpei_legal_document(text,text,text) TO authenticated;
CREATE FUNCTION public.approve_bpei_legal_document(p_kind text,p_version text,p_content text)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $$SELECT bpei_private.approve_bpei_legal_document(p_kind,p_version,p_content)$$;
REVOKE ALL ON FUNCTION public.approve_bpei_legal_document(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_bpei_legal_document(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION bpei_private.publish_bpei_legal_documents(p_version text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE operator_id uuid:=(SELECT auth.uid());doc_count integer;
BEGIN
 IF operator_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=operator_id) THEN
   RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501';
 END IF;
 IF p_version IS NULL OR p_version !~ '^[a-zA-Z0-9._-]{3,90}$' THEN
   RAISE EXCEPTION 'Invalid version' USING ERRCODE='22023'; END IF;
 SELECT count(DISTINCT kind) INTO doc_count FROM public.bpei_legal_documents WHERE version=p_version;
 IF doc_count<>3 THEN
   RAISE EXCEPTION 'All three approved documents are required' USING ERRCODE='22023';
 END IF;
 UPDATE public.bpei_launch_controls SET
    legal_documents_published=true,
    independent_registration_enabled=false,
    legal_version=p_version,
    legal_published_at=now(),
    updated_at=now()
 WHERE id=true;
 RETURN jsonb_build_object('version',p_version,'published',true,'registrations_open',false);
END; $$;
REVOKE ALL ON FUNCTION bpei_private.publish_bpei_legal_documents(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.publish_bpei_legal_documents(text) TO authenticated;
CREATE FUNCTION public.publish_bpei_legal_documents(p_version text)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $$ SELECT bpei_private.publish_bpei_legal_documents(p_version) $$;
REVOKE ALL ON FUNCTION public.publish_bpei_legal_documents(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_bpei_legal_documents(text) TO authenticated;

-- Prevent manually writing over legally published documents via privileged operations.
CREATE OR REPLACE FUNCTION bpei_private.block_published_bpei_document_changes()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.bpei_launch_controls
  WHERE legal_documents_published=true AND legal_version=OLD.version) THEN
  RAISE EXCEPTION 'Published documents are immutable: create a new legal version' USING ERRCODE='22023';
 END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
REVOKE ALL ON FUNCTION bpei_private.block_published_bpei_document_changes() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_legal_published_immutable BEFORE UPDATE OR DELETE ON public.bpei_legal_documents
 FOR EACH ROW EXECUTE FUNCTION bpei_private.block_published_bpei_document_changes();
