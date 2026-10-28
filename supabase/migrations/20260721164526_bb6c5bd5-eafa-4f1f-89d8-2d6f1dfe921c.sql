-- 1) Table drapeaux par environnement
CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL CHECK (length(feature_key) > 0),
  environment text NOT NULL CHECK (environment IN ('preview','production')),
  enabled boolean NOT NULL DEFAULT false,
  configuration jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_feature_flags_unique UNIQUE (feature_key, environment)
);
GRANT SELECT ON public.platform_feature_flags TO authenticated;
GRANT ALL ON public.platform_feature_flags TO service_role;
ALTER TABLE public.platform_feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read feature flags"
  ON public.platform_feature_flags FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner_bpei writes feature flags"
  ON public.platform_feature_flags FOR ALL TO authenticated
  USING (public.is_owner_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()));

INSERT INTO public.platform_feature_flags(feature_key, environment, enabled)
VALUES ('ai_import_enabled','preview', false),
       ('ai_import_enabled','production', false)
ON CONFLICT (feature_key, environment) DO NOTHING;

-- 2) Table liste blanche pilote par environnement
CREATE TABLE IF NOT EXISTS public.shop_feature_pilot_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  feature_key text NOT NULL CHECK (length(feature_key) > 0),
  environment text NOT NULL CHECK (environment IN ('preview','production')),
  enabled boolean NOT NULL DEFAULT true,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_feature_pilot_access_unique UNIQUE (shop_id, feature_key, environment)
);
GRANT SELECT ON public.shop_feature_pilot_access TO authenticated;
GRANT ALL ON public.shop_feature_pilot_access TO service_role;
ALTER TABLE public.shop_feature_pilot_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own pilot access or owner_bpei"
  ON public.shop_feature_pilot_access FOR SELECT TO authenticated USING (
    public.is_owner_bpei(auth.uid())
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.owner_user_id = auth.uid())
  );
CREATE POLICY "owner_bpei writes pilot access"
  ON public.shop_feature_pilot_access FOR ALL TO authenticated
  USING (public.is_owner_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()));

-- 3) Fonctions helper
CREATE OR REPLACE FUNCTION public.is_ai_import_enabled_env(_env text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT enabled FROM public.platform_feature_flags
    WHERE feature_key = 'ai_import_enabled' AND environment = _env
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.is_ai_import_pilot_env(_shop_id uuid, _env text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_ai_import_enabled_env(_env)
    AND EXISTS (
      SELECT 1 FROM public.shop_feature_pilot_access p
      WHERE p.shop_id = _shop_id
        AND p.feature_key = 'ai_import_enabled'
        AND p.environment = _env
        AND p.enabled = true
        AND p.revoked_at IS NULL
    )
$$;

CREATE OR REPLACE FUNCTION public.set_ai_import_enabled_env(_env text, _enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'Réservé aux owner_bpei'; END IF;
  IF _env NOT IN ('preview','production') THEN RAISE EXCEPTION 'Environnement inconnu'; END IF;
  INSERT INTO public.platform_feature_flags(feature_key, environment, enabled, updated_by, updated_at)
    VALUES ('ai_import_enabled', _env, _enabled, auth.uid(), now())
    ON CONFLICT (feature_key, environment) DO UPDATE
      SET enabled = EXCLUDED.enabled,
          updated_by = auth.uid(),
          updated_at = now();
  RETURN _enabled;
END $$;

CREATE OR REPLACE FUNCTION public.grant_ai_import_pilot_env(_shop_id uuid, _env text, _enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'Réservé aux owner_bpei'; END IF;
  IF _env NOT IN ('preview','production') THEN RAISE EXCEPTION 'Environnement inconnu'; END IF;
  INSERT INTO public.shop_feature_pilot_access(shop_id, feature_key, environment, enabled, granted_by, granted_at, revoked_at)
    VALUES (_shop_id, 'ai_import_enabled', _env, _enabled, auth.uid(), now(),
            CASE WHEN _enabled THEN NULL ELSE now() END)
    ON CONFLICT (shop_id, feature_key, environment) DO UPDATE
      SET enabled = EXCLUDED.enabled,
          granted_by = auth.uid(),
          revoked_at = CASE WHEN EXCLUDED.enabled THEN NULL ELSE now() END,
          granted_at = CASE
            WHEN EXCLUDED.enabled AND public.shop_feature_pilot_access.enabled = false THEN now()
            ELSE public.shop_feature_pilot_access.granted_at END;
  RETURN _enabled;
END $$;

GRANT EXECUTE ON FUNCTION public.is_ai_import_enabled_env(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ai_import_pilot_env(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_ai_import_enabled_env(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_ai_import_pilot_env(uuid, text, boolean) TO authenticated;

-- 4) Ancien drapeau global forcé à false (obsolète, conservé pour compat)
UPDATE public.app_settings SET value = 'false'::jsonb WHERE key = 'ai_import_enabled';
INSERT INTO public.app_settings(key, value)
  VALUES ('ai_import_enabled', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;