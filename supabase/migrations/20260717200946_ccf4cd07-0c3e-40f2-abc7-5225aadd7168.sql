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
    blockers := array_append(blockers, 'Contenu vide');
  END IF;
  IF doc.version IS NULL OR doc.version < 1 THEN
    blockers := array_append(blockers, 'Version manquante');
  END IF;
  SELECT array_agg(DISTINCT m[1]) INTO remaining_vars
  FROM regexp_matches(COALESCE(doc.content, ''), '\{\{([A-Z_][A-Z0-9_]*)\}\}', 'g') AS m;
  IF remaining_vars IS NOT NULL AND array_length(remaining_vars, 1) > 0 THEN
    blockers := array_append(blockers, 'Variables non renseignées: ' || array_to_string(remaining_vars, ', '));
  END IF;
  IF doc.effective_date IS NULL THEN
    blockers := array_append(blockers, 'Date d''effet manquante');
  END IF;
  IF doc.status = 'draft' THEN
    blockers := array_append(blockers, 'Revue interne / externe non consignée (status=draft)');
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