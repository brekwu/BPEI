CREATE POLICY "shop_logos_read_members" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'shop-logos'
  AND EXISTS (
    SELECT 1 FROM public.shop_memberships m
    WHERE m.shop_id = ((storage.foldername(name))[1])::uuid
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "shop_logos_insert_managers" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shop-logos'
  AND EXISTS (
    SELECT 1 FROM public.shop_memberships m
    WHERE m.shop_id = ((storage.foldername(name))[1])::uuid
      AND m.user_id = auth.uid()
      AND m.role IN ('shop_manager','network_owner')
  )
);

CREATE POLICY "shop_logos_update_managers" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'shop-logos'
  AND EXISTS (
    SELECT 1 FROM public.shop_memberships m
    WHERE m.shop_id = ((storage.foldername(name))[1])::uuid
      AND m.user_id = auth.uid()
      AND m.role IN ('shop_manager','network_owner')
  )
);

CREATE POLICY "shop_logos_delete_managers" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'shop-logos'
  AND EXISTS (
    SELECT 1 FROM public.shop_memberships m
    WHERE m.shop_id = ((storage.foldername(name))[1])::uuid
      AND m.user_id = auth.uid()
      AND m.role IN ('shop_manager','network_owner')
  )
);