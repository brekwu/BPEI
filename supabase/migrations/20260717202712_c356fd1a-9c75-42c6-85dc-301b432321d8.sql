-- Secure public RPC: returns at most one published legal document, whitelisted columns only.
CREATE OR REPLACE FUNCTION public.get_published_legal_document_public(
  p_document_code text,
  p_language text DEFAULT 'fr'
)
RETURNS TABLE (
  id uuid,
  document_code text,
  title text,
  version integer,
  content text,
  summary text,
  effective_date date,
  published_at timestamptz,
  content_hash text,
  language text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id, d.document_code, d.title, d.version, d.content, d.summary,
    d.effective_date, d.published_at, d.content_hash, d.language, d.updated_at
  FROM public.legal_documents d
  WHERE d.status = 'published'
    AND d.document_code = p_document_code
    AND d.language = COALESCE(p_language, 'fr')
    AND (d.effective_date IS NULL OR d.effective_date <= CURRENT_DATE)
  ORDER BY d.version DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_published_legal_document_public(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_legal_document_public(text, text) TO anon, authenticated, service_role;

-- Revoke direct anon SELECT on the table; anon must go through the RPC.
REVOKE SELECT ON public.legal_documents FROM anon;