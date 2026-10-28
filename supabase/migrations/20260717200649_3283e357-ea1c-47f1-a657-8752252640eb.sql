-- Add revision + restore tracking columns
ALTER TABLE public.legal_documents
  ADD COLUMN IF NOT EXISTS previous_version_id uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS restored_from_version_id uuid REFERENCES public.legal_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id);

-- Harden the update lock: no direct edit of published rows (any content/effect/version/status backward)
CREATE OR REPLACE FUNCTION public.legal_documents_lock_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'published' THEN
    -- Only allow: transitioning to 'archived' (via archive path) OR pure metadata timestamps
    IF NEW.status = 'archived' AND OLD.status = 'published' THEN
      NEW.archived_at := COALESCE(NEW.archived_at, now());
      NEW.updated_at := now();
      RETURN NEW;
    END IF;
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.effective_date IS DISTINCT FROM OLD.effective_date
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.document_code IS DISTINCT FROM OLD.document_code
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.title IS DISTINCT FROM OLD.title THEN
      RAISE EXCEPTION 'Version publiée immuable — utilisez create_legal_document_revision().';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

-- Atomic publish RPC (owner_bpei only)
CREATE OR REPLACE FUNCTION public.publish_legal_document(
  _document_id uuid,
  _effective_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc public.legal_documents;
  chk jsonb;
  prev_published_id uuid;
  new_hash text;
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN
    RAISE EXCEPTION 'Seul le patron (owner_bpei) peut publier un document juridique.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO doc FROM public.legal_documents WHERE id = _document_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document introuvable' USING ERRCODE = '42704';
  END IF;

  IF _effective_date IS NOT NULL THEN
    UPDATE public.legal_documents SET effective_date = _effective_date WHERE id = _document_id;
    doc.effective_date := _effective_date;
  END IF;

  chk := public.check_legal_document_publishable(_document_id);
  IF NOT (chk->>'publishable')::boolean THEN
    RAISE EXCEPTION 'Publication refusée: %', chk->'blockers'
      USING ERRCODE = '22023';
  END IF;

  -- Archive previously-published version of same document_code+language+scope
  SELECT id INTO prev_published_id
    FROM public.legal_documents
   WHERE document_code = doc.document_code
     AND language = doc.language
     AND scope = doc.scope
     AND status = 'published'
     AND id <> _document_id
   LIMIT 1;

  IF prev_published_id IS NOT NULL THEN
    UPDATE public.legal_documents
       SET status = 'archived', archived_at = now(), updated_at = now()
     WHERE id = prev_published_id;
    UPDATE public.legal_documents
       SET previous_version_id = prev_published_id
     WHERE id = _document_id;
  END IF;

  new_hash := encode(digest(COALESCE(doc.content, ''), 'sha256'), 'hex');

  UPDATE public.legal_documents
     SET status = 'published',
         published_at = now(),
         published_by = auth.uid(),
         content_hash = new_hash,
         updated_at = now()
   WHERE id = _document_id;

  RETURN jsonb_build_object(
    'ok', true,
    'document_id', _document_id,
    'previous_version_id', prev_published_id,
    'content_hash', new_hash,
    'published_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_legal_document(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_legal_document(uuid, date) TO authenticated;

-- Revision creation (draft copy of any document)
CREATE OR REPLACE FUNCTION public.create_legal_document_revision(_source_document_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src public.legal_documents;
  next_version integer;
  new_id uuid;
BEGIN
  IF NOT (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'Non autorisé' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO src FROM public.legal_documents WHERE id = _source_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document source introuvable' USING ERRCODE = '42704';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM public.legal_documents
   WHERE document_code = src.document_code
     AND language = src.language
     AND scope = src.scope;

  INSERT INTO public.legal_documents (
    document_code, title, audience, scope, language, version, status,
    content, summary, requires_acceptance, requires_reacceptance,
    created_by, previous_version_id
  ) VALUES (
    src.document_code, src.title, src.audience, src.scope, src.language, next_version, 'draft',
    src.content, src.summary, src.requires_acceptance, src.requires_reacceptance,
    auth.uid(), _source_document_id
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_legal_document_revision(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_legal_document_revision(uuid) TO authenticated;

-- Sensitive module denial audit table
CREATE TABLE IF NOT EXISTS public.sensitive_module_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  module_code text NOT NULL,
  action text,
  route text,
  result text NOT NULL CHECK (result IN ('allowed','denied','error')),
  reason text,
  status_at_check text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sensitive_module_access_log TO authenticated;
GRANT ALL ON public.sensitive_module_access_log TO service_role;
ALTER TABLE public.sensitive_module_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sensitive_log_read_owner ON public.sensitive_module_access_log
  FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'));

CREATE POLICY sensitive_log_insert_any ON public.sensitive_module_access_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_sensitive_log_module_created
  ON public.sensitive_module_access_log(module_code, created_at DESC);

-- Convenience RPC to log denial (SECURITY DEFINER to bypass user_id NULL edge cases)
CREATE OR REPLACE FUNCTION public.log_sensitive_module_denial(
  _module_code text,
  _action text,
  _route text,
  _reason text,
  _status text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sensitive_module_access_log
    (user_id, module_code, action, route, result, reason, status_at_check)
  VALUES (auth.uid(), _module_code, _action, _route, 'denied', _reason, _status);
END;
$$;
REVOKE ALL ON FUNCTION public.log_sensitive_module_denial(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_sensitive_module_denial(text,text,text,text,text) TO authenticated;