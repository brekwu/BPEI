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

  new_hash := encode(sha256(convert_to(COALESCE(doc.content, ''), 'UTF8')), 'hex');

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