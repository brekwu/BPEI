-- Table de flags de test pour la simulation d'échecs de propagation
-- Réservée aux owners. Aucun impact sur le comportement de production
-- car les valeurs par défaut sont vides.
CREATE TABLE IF NOT EXISTS public.platform_probe_test_flags (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fail_consumer_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.platform_probe_test_flags (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT, UPDATE ON public.platform_probe_test_flags TO authenticated;
GRANT ALL ON public.platform_probe_test_flags TO service_role;
ALTER TABLE public.platform_probe_test_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_probe_flags" ON public.platform_probe_test_flags;
CREATE POLICY "owner_read_probe_flags" ON public.platform_probe_test_flags
  FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei'));

-- RPC owner-only pour lire les flags (utilisé par le sonde serveur)
CREATE OR REPLACE FUNCTION public.owner_get_probe_test_flags()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flags text[];
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT fail_consumer_keys INTO v_flags FROM public.platform_probe_test_flags WHERE id = 1;
  RETURN COALESCE(v_flags, ARRAY[]::text[]);
END; $$;

REVOKE ALL ON FUNCTION public.owner_get_probe_test_flags() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_get_probe_test_flags() TO authenticated;

-- RPC owner-only pour définir les flags
CREATE OR REPLACE FUNCTION public.owner_set_probe_test_flags(p_keys text[])
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.platform_probe_test_flags
    SET fail_consumer_keys = COALESCE(p_keys, ARRAY[]::text[]),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = 1;
  RETURN COALESCE(p_keys, ARRAY[]::text[]);
END; $$;

REVOKE ALL ON FUNCTION public.owner_set_probe_test_flags(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_set_probe_test_flags(text[]) TO authenticated;

-- Étendre les statuts autorisés dans record_consumer_observation avec 'retrying'
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
  IF p_status NOT IN ('pending','success','failed','skipped','not_applicable','retrying') THEN
    RAISE EXCEPTION 'Statut invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE public.platform_settings_consumer_status
    SET observed_version = p_observed_version,
        status = p_status,
        last_error_code = CASE WHEN p_status = 'failed' THEN p_error_code ELSE last_error_code END,
        last_error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE last_error_message END,
        last_checked_at = now()
    WHERE publication_id = p_publication_id AND consumer_key = p_consumer_key;
END; $$;

-- Verrou anti-double-retry côté serveur : garantit qu'un retry en cours
-- ne peut pas être relancé tant que le statut est 'retrying'.
CREATE OR REPLACE FUNCTION public.owner_start_consumer_retry(
  p_publication_id uuid,
  p_consumer_key text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.platform_settings_consumer_status
    SET attempts = attempts + 1,
        last_attempt_at = now(),
        status = 'retrying'
    WHERE publication_id = p_publication_id
      AND consumer_key = p_consumer_key
      AND status <> 'retrying';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END; $$;

REVOKE ALL ON FUNCTION public.owner_start_consumer_retry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_start_consumer_retry(uuid, text) TO authenticated;

-- RPC de calcul du statut global d'une publication
CREATE OR REPLACE FUNCTION public.owner_compute_publication_status(p_publication_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_essential_failed integer;
  v_any_failed integer;
  v_pending integer;
  v_total integer;
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT
    COUNT(*) FILTER (WHERE is_essential AND status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status IN ('pending','retrying')),
    COUNT(*)
  INTO v_essential_failed, v_any_failed, v_pending, v_total
  FROM public.platform_settings_consumer_status
  WHERE publication_id = p_publication_id;
  IF v_total = 0 THEN RETURN 'publishing'; END IF;
  IF v_pending > 0 THEN RETURN 'publishing'; END IF;
  IF v_essential_failed > 0 THEN RETURN 'failed'; END IF;
  IF v_any_failed > 0 THEN RETURN 'partially_failed'; END IF;
  RETURN 'published';
END; $$;

REVOKE ALL ON FUNCTION public.owner_compute_publication_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_compute_publication_status(uuid) TO authenticated;