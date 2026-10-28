-- 1. Table: single-row SSOT with draft + published JSONB blobs
CREATE TABLE IF NOT EXISTS public.platform_public_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  published jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_version integer NOT NULL DEFAULT 0,
  draft_updated_at timestamptz NOT NULL DEFAULT now(),
  draft_updated_by uuid REFERENCES auth.users(id),
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id)
);
GRANT SELECT ON public.platform_public_settings TO authenticated;
GRANT ALL ON public.platform_public_settings TO service_role;
ALTER TABLE public.platform_public_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read platform_public_settings" ON public.platform_public_settings
  FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei'));

-- Seed the single row
INSERT INTO public.platform_public_settings (id, draft, published)
VALUES (1, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Publications history / rollback log
CREATE TABLE IF NOT EXISTS public.platform_settings_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  note text,
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('pending','publishing','published','partially_failed','failed','rolled_back')),
  published_by uuid REFERENCES auth.users(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  rollback_of uuid REFERENCES public.platform_settings_publications(id)
);
CREATE INDEX IF NOT EXISTS idx_psp_version ON public.platform_settings_publications (version DESC);
GRANT SELECT ON public.platform_settings_publications TO authenticated;
GRANT ALL ON public.platform_settings_publications TO service_role;
ALTER TABLE public.platform_settings_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read publications" ON public.platform_settings_publications
  FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei'));

-- 3. Public getter: returns published JSONB, callable by anon
CREATE OR REPLACE FUNCTION public.get_public_platform_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(published, '{}'::jsonb) FROM public.platform_public_settings WHERE id = 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_platform_settings() TO anon, authenticated;

-- 4. Owner getter (draft + published + last 20 publications)
CREATE OR REPLACE FUNCTION public.owner_get_platform_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.platform_public_settings;
  v_pubs jsonb;
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.platform_public_settings WHERE id = 1;
  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.version DESC), '[]'::jsonb) INTO v_pubs
    FROM (SELECT * FROM public.platform_settings_publications ORDER BY version DESC LIMIT 20) p;
  RETURN jsonb_build_object(
    'draft', v_row.draft,
    'published', v_row.published,
    'published_version', v_row.published_version,
    'draft_updated_at', v_row.draft_updated_at,
    'published_at', v_row.published_at,
    'publications', v_pubs
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.owner_get_platform_settings() TO authenticated;

-- 5. Save draft
CREATE OR REPLACE FUNCTION public.owner_save_platform_settings_draft(p_draft jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.platform_public_settings
    SET draft = COALESCE(p_draft, '{}'::jsonb),
        draft_updated_at = now(),
        draft_updated_by = auth.uid()
    WHERE id = 1;
END; $$;
GRANT EXECUTE ON FUNCTION public.owner_save_platform_settings_draft(jsonb) TO authenticated;

-- 6. Publish (draft -> published, record history)
CREATE OR REPLACE FUNCTION public.owner_publish_platform_settings(p_changed_fields text[] DEFAULT '{}', p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_version integer;
  v_draft jsonb;
  v_pub_id uuid;
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT draft, published_version + 1 INTO v_draft, v_new_version
    FROM public.platform_public_settings WHERE id = 1 FOR UPDATE;

  UPDATE public.platform_public_settings
    SET published = v_draft,
        published_version = v_new_version,
        published_at = now(),
        published_by = auth.uid()
    WHERE id = 1;

  INSERT INTO public.platform_settings_publications
    (version, snapshot, changed_fields, note, status, published_by)
    VALUES (v_new_version, v_draft, COALESCE(p_changed_fields, '{}'), p_note, 'published', auth.uid())
    RETURNING id INTO v_pub_id;

  RETURN jsonb_build_object('version', v_new_version, 'publication_id', v_pub_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.owner_publish_platform_settings(text[], text) TO authenticated;

-- 7. Restore version
CREATE OR REPLACE FUNCTION public.owner_restore_platform_settings_version(p_publication_id uuid)
RETURNS jsonb
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
    (version, snapshot, changed_fields, note, status, published_by, rollback_of)
    VALUES (v_new_version, v_snapshot, ARRAY['__rollback__'],
            'Restauration de la version ' || v_source_version, 'rolled_back', auth.uid(), p_publication_id)
    RETURNING id INTO v_pub_id;

  RETURN jsonb_build_object('version', v_new_version, 'publication_id', v_pub_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.owner_restore_platform_settings_version(uuid) TO authenticated;