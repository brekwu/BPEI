CREATE OR REPLACE FUNCTION public.get_published_platform_public_settings()
RETURNS TABLE (
  published jsonb,
  published_version integer,
  published_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT published, published_version, published_at
  FROM public.platform_public_settings
  WHERE id = 1;
$$;

REVOKE ALL ON FUNCTION public.get_published_platform_public_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_platform_public_settings() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_published_platform_legal_settings()
RETURNS SETOF public.platform_legal_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.platform_legal_settings LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_published_platform_legal_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_platform_legal_settings() TO anon, authenticated, service_role;