-- 1. Colonne motif de rollback
ALTER TABLE public.platform_settings_publications
  ADD COLUMN IF NOT EXISTS rollback_reason text,
  ADD COLUMN IF NOT EXISTS restored_from_version integer;

-- 2. Table de suivi par consommateur
CREATE TABLE IF NOT EXISTS public.platform_settings_consumer_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES public.platform_settings_publications(id) ON DELETE CASCADE,
  consumer_key text NOT NULL,
  is_essential boolean NOT NULL DEFAULT false,
  expected_version integer NOT NULL,
  observed_version integer,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error_code text,
  last_error_message text,
  last_checked_at timestamptz,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (publication_id, consumer_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings_consumer_status TO authenticated;
GRANT ALL ON public.platform_settings_consumer_status TO service_role;

ALTER TABLE public.platform_settings_consumer_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_read_consumer_status" ON public.platform_settings_consumer_status
  FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei'));

CREATE POLICY "owner_write_consumer_status" ON public.platform_settings_consumer_status
  FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei'));

-- 3. Initialiser les consommateurs pour une publication
CREATE OR REPLACE FUNCTION public.owner_seed_publication_consumers(p_publication_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected integer;
  v_essentials text[] := ARRAY['header','footer','contact','mentions_legales','seo_root'];
  v_all text[] := ARRAY['header','footer','accueil','contact','reclamations','mentions_legales',
                        'confidentialite','cgu','cookies','tarifs','rejoindre',
                        'seo_root','open_graph','favicon','sitemap','emails'];
  v_count integer := 0;
  k text;
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT version INTO v_expected FROM public.platform_settings_publications WHERE id = p_publication_id;
  IF v_expected IS NULL THEN
    RAISE EXCEPTION 'Publication introuvable' USING ERRCODE = 'P0002';
  END IF;
  FOREACH k IN ARRAY v_all LOOP
    INSERT INTO public.platform_settings_consumer_status
      (publication_id, consumer_key, is_essential, expected_version, status)
      VALUES (p_publication_id, k, k = ANY(v_essentials), v_expected, 'pending')
    ON CONFLICT (publication_id, consumer_key) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

-- 4. Enregistrer une observation
CREATE OR REPLACE FUNCTION public.owner_record_consumer_observation(
  p_publication_id uuid,
  p_consumer_key text,
  p_observed_version integer,
  p_status text,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending','success','failed','skipped','not_applicable') THEN
    RAISE EXCEPTION 'Statut invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE public.platform_settings_consumer_status
    SET observed_version = p_observed_version,
        status = p_status,
        last_error_code = CASE WHEN p_status = 'failed' THEN p_error_code ELSE NULL END,
        last_error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE NULL END,
        last_checked_at = now()
    WHERE publication_id = p_publication_id AND consumer_key = p_consumer_key;
END; $$;

-- 5. Retry marqueur
CREATE OR REPLACE FUNCTION public.owner_mark_consumer_retry(
  p_publication_id uuid,
  p_consumer_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.platform_settings_consumer_status
    SET attempts = attempts + 1,
        last_attempt_at = now(),
        status = 'pending'
    WHERE publication_id = p_publication_id
      AND consumer_key = p_consumer_key
      AND status = 'failed';
END; $$;

-- 6. Rollback avec motif obligatoire
CREATE OR REPLACE FUNCTION public.owner_rollback_platform_settings_with_reason(
  p_publication_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot jsonb;
  v_source_version integer;
  v_new_version integer;
  v_pub_id uuid;
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Motif obligatoire (5 caractères minimum)' USING ERRCODE = '22023';
  END IF;
  SELECT snapshot, version INTO v_snapshot, v_source_version
    FROM public.platform_settings_publications WHERE id = p_publication_id;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Publication introuvable' USING ERRCODE = 'P0002';
  END IF;

  SELECT published_version + 1 INTO v_new_version
    FROM public.platform_public_settings WHERE id = 1 FOR UPDATE;

  UPDATE public.platform_public_settings
    SET published = v_snapshot,
        draft = v_snapshot,
        published_version = v_new_version,
        published_at = now(),
        published_by = auth.uid(),
        draft_updated_at = now(),
        draft_updated_by = auth.uid()
    WHERE id = 1;

  INSERT INTO public.platform_settings_publications
    (version, snapshot, changed_fields, note, status, published_by,
     rollback_of, rollback_reason, restored_from_version)
    VALUES (v_new_version, v_snapshot, ARRAY['__rollback__'],
            'Rollback → v' || v_source_version, 'rolled_back', auth.uid(),
            p_publication_id, p_reason, v_source_version)
    RETURNING id INTO v_pub_id;

  PERFORM public.owner_seed_publication_consumers(v_pub_id);

  RETURN jsonb_build_object('version', v_new_version, 'publication_id', v_pub_id);
END; $$;

-- 7. Lister consommateurs d'une publication
CREATE OR REPLACE FUNCTION public.owner_list_publication_consumers(p_publication_id uuid)
RETURNS SETOF public.platform_settings_consumer_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT * FROM public.platform_settings_consumer_status
    WHERE publication_id = p_publication_id
    ORDER BY is_essential DESC, consumer_key;
END; $$;