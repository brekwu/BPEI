DROP POLICY IF EXISTS "Prestations actives publiques" ON public.service_catalog;

CREATE POLICY "Prestations publiques boutiques publiees"
ON public.service_catalog
FOR SELECT
TO anon
USING (
  active = true
  AND archived_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = service_catalog.shop_id
      AND s.status = 'validated'::shop_status
      AND s.public_profile_status = 'published'
  )
);