-- Policies for shop-verification bucket (private).
-- Path convention: verification/<shop_id>/<filename>
DROP POLICY IF EXISTS shop_verification_read ON storage.objects;
CREATE POLICY shop_verification_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'shop-verification'
  AND (
    public.has_platform_role(auth.uid(), 'owner_bpei')
    OR public.has_platform_role(auth.uid(), 'admin_bpei')
    OR (
      (storage.foldername(name))[1] = 'verification'
      AND EXISTS (
        SELECT 1 FROM public.shop_memberships m
         WHERE m.shop_id::text = (storage.foldername(name))[2]
           AND m.user_id = auth.uid()
           AND m.role IN ('shop_manager','network_owner')
      )
    )
  )
);

DROP POLICY IF EXISTS shop_verification_insert ON storage.objects;
CREATE POLICY shop_verification_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'shop-verification'
  AND (storage.foldername(name))[1] = 'verification'
  AND EXISTS (
    SELECT 1 FROM public.shop_memberships m
     WHERE m.shop_id::text = (storage.foldername(name))[2]
       AND m.user_id = auth.uid()
       AND m.role IN ('shop_manager','network_owner')
  )
);

DROP POLICY IF EXISTS shop_verification_delete ON storage.objects;
CREATE POLICY shop_verification_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'shop-verification'
  AND (
    public.has_platform_role(auth.uid(), 'owner_bpei')
    OR (
      (storage.foldername(name))[1] = 'verification'
      AND EXISTS (
        SELECT 1 FROM public.shop_memberships m
         WHERE m.shop_id::text = (storage.foldername(name))[2]
           AND m.user_id = auth.uid()
           AND m.role IN ('shop_manager','network_owner')
      )
    )
  )
);