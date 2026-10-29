REVOKE ALL ON public.service_catalog FROM anon;
GRANT SELECT ON public.service_catalog TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_catalog TO authenticated;
GRANT ALL ON public.service_catalog TO service_role;