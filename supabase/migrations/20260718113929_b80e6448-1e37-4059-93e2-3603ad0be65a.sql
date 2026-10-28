-- 1. shops: remove overly-broad public SELECT policies (use shops_public view instead)
DROP POLICY IF EXISTS shops_public_view_anon_select ON public.shops;
DROP POLICY IF EXISTS shops_public_view_auth_select ON public.shops;

-- 2. verification_documents: fix swapped args in is_shop_member(_user, _shop)
DROP POLICY IF EXISTS verification_documents_shop_members ON public.verification_documents;
CREATE POLICY verification_documents_shop_members
  ON public.verification_documents
  FOR ALL
  USING (
    public.is_shop_member(auth.uid(), shop_id)
    OR public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role)
    OR public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role)
  )
  WITH CHECK (
    public.is_shop_member(auth.uid(), shop_id)
    OR public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role)
  );

-- 3. Tighten permissive WITH CHECK (true) INSERT policies
DROP POLICY IF EXISTS "anyone submits privacy request" ON public.privacy_requests;
CREATE POLICY "anyone submits privacy request"
  ON public.privacy_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- Anonymous submissions must not claim a requester_user_id;
    -- authenticated submissions must match auth.uid().
    (requester_user_id IS NULL AND auth.uid() IS NULL)
    OR (requester_user_id = auth.uid())
    OR (requester_user_id IS NULL AND auth.uid() IS NOT NULL)
  );

DROP POLICY IF EXISTS "insert cookie consent" ON public.cookie_consents;
CREATE POLICY "insert cookie consent"
  ON public.cookie_consents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (user_id IS NULL) OR (user_id = auth.uid())
  );