-- Central sensitive module guard (server-side)
CREATE OR REPLACE FUNCTION public.assert_sensitive_module_available(_module_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.sensitive_module_approvals;
BEGIN
  SELECT * INTO rec FROM public.sensitive_module_approvals WHERE module_code = _module_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'status', 'unknown',
      'reason', 'Module inconnu',
      'blockers', 'Module non déclaré dans sensitive_module_approvals'
    );
  END IF;
  IF rec.current_status IN ('approved', 'active', 'production_ready') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'status', rec.current_status,
      'reason', null,
      'blockers', null
    );
  END IF;
  RETURN jsonb_build_object(
    'allowed', false,
    'status', rec.current_status,
    'reason', format('Module %s non activé (statut: %s)', rec.module_code, rec.current_status),
    'blockers', COALESCE(rec.blockers, 'Validation owner_bpei requise')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assert_sensitive_module_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_sensitive_module_available(text) TO authenticated, service_role;

-- Publish-gating for legal documents
CREATE OR REPLACE FUNCTION public.check_legal_document_publishable(_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc public.legal_documents;
  blockers text[] := ARRAY[]::text[];
  remaining_vars text[];
BEGIN
  SELECT * INTO doc FROM public.legal_documents WHERE id = _document_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('publishable', false, 'blockers', ARRAY['Document introuvable']);
  END IF;
  IF doc.status = 'published' THEN
    RETURN jsonb_build_object('publishable', false, 'blockers', ARRAY['Déjà publié']);
  END IF;
  IF doc.content IS NULL OR length(trim(doc.content)) = 0 THEN
    blockers := blockers || 'Contenu vide';
  END IF;
  IF doc.version IS NULL OR doc.version < 1 THEN
    blockers := blockers || 'Version manquante';
  END IF;
  -- Remaining {{VARIABLES}} placeholders
  SELECT array_agg(DISTINCT m[1]) INTO remaining_vars
  FROM regexp_matches(COALESCE(doc.content, ''), '\{\{([A-Z_][A-Z0-9_]*)\}\}', 'g') AS m;
  IF remaining_vars IS NOT NULL AND array_length(remaining_vars, 1) > 0 THEN
    blockers := blockers || ('Variables non renseignées: ' || array_to_string(remaining_vars, ', '));
  END IF;
  IF doc.effective_date IS NULL THEN
    blockers := blockers || 'Date d''effet manquante';
  END IF;
  IF doc.status = 'draft' THEN
    blockers := blockers || 'Revue interne / externe non consignée (status=draft)';
  END IF;
  RETURN jsonb_build_object(
    'publishable', COALESCE(array_length(blockers, 1), 0) = 0,
    'blockers', blockers,
    'document_code', doc.document_code,
    'version', doc.version,
    'status', doc.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_legal_document_publishable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_legal_document_publishable(uuid) TO authenticated, service_role;