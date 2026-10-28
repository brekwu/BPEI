-- 1. Extension shops : onboarding + statut page publique + médias
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS onboarding_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS onboarding_current_step text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS public_profile_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS public_logo_url text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS social_share_image_url text;

-- Contraintes de valeurs pour éviter les statuts libres
DO $$ BEGIN
  ALTER TABLE public.shops ADD CONSTRAINT shops_onboarding_status_chk
    CHECK (onboarding_status IN ('not_started','in_progress','completed','skipped_partially'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.shops ADD CONSTRAINT shops_public_profile_status_chk
    CHECK (public_profile_status IN ('draft','ready_for_review','published','unpublished','suspended'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extension shop_invitations
ALTER TABLE public.shop_invitations
  ADD COLUMN IF NOT EXISTS attempts_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id);

-- 3. Durcissement de accept_shop_invitation (refus si revoked_at set + log tentatives)
CREATE OR REPLACE FUNCTION public.accept_shop_invitation(_token text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _inv public.shop_invitations%ROWTYPE;
  _email text;
BEGIN
  SELECT * INTO _inv FROM public.shop_invitations WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation introuvable'; END IF;

  -- Log tentative
  UPDATE public.shop_invitations
    SET attempts_count = attempts_count + 1, last_attempt_at = now()
    WHERE id = _inv.id;

  IF _inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation révoquée'; END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation invalide'; END IF;
  IF _inv.expires_at < now() THEN
    UPDATE public.shop_invitations SET status = 'expired' WHERE id = _inv.id;
    RAISE EXCEPTION 'Invitation expirée';
  END IF;
  _email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  IF _email = '' OR _email <> lower(_inv.email) THEN
    RAISE EXCEPTION 'Cette invitation ne correspond pas à votre compte';
  END IF;

  INSERT INTO public.shop_memberships(user_id, shop_id, role)
  VALUES (auth.uid(), _inv.shop_id, _inv.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.shop_invitations
     SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
   WHERE id = _inv.id;

  RETURN _inv.shop_id;
END;
$function$;

-- 4. Actions patron / créateur sur invitations
CREATE OR REPLACE FUNCTION public.owner_revoke_invitation(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _inv public.shop_invitations%ROWTYPE;
BEGIN
  SELECT * INTO _inv FROM public.shop_invitations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation introuvable'; END IF;
  IF NOT (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid())
        OR _inv.invited_by = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation non pending'; END IF;
  UPDATE public.shop_invitations
    SET status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
    WHERE id = _id;
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action, new_value)
    VALUES (auth.uid(), _inv.shop_id, 'revoke_invitation', jsonb_build_object('invitation_id', _id, 'email', _inv.email));
END $$;

CREATE OR REPLACE FUNCTION public.owner_resend_invitation(_id uuid)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE _inv public.shop_invitations%ROWTYPE; _tok text;
BEGIN
  SELECT * INTO _inv FROM public.shop_invitations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation introuvable'; END IF;
  IF NOT (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid())
        OR _inv.invited_by = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _inv.status = 'accepted' THEN RAISE EXCEPTION 'déjà acceptée'; END IF;
  _tok := replace(replace(replace(encode(extensions.gen_random_bytes(24),'base64'),'/','_'),'+','-'),'=','');
  UPDATE public.shop_invitations
    SET token = _tok, status = 'pending', expires_at = now() + interval '30 days',
        revoked_at = NULL, revoked_by = NULL, attempts_count = 0
    WHERE id = _id;
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action, new_value)
    VALUES (auth.uid(), _inv.shop_id, 'resend_invitation', jsonb_build_object('invitation_id', _id));
  RETURN _tok;
END $$;

CREATE OR REPLACE FUNCTION public.owner_change_invitation_email(_id uuid, _new_email text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _inv public.shop_invitations%ROWTYPE;
BEGIN
  IF _new_email IS NULL OR position('@' in _new_email) < 2 THEN
    RAISE EXCEPTION 'email invalide';
  END IF;
  SELECT * INTO _inv FROM public.shop_invitations WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation introuvable'; END IF;
  IF NOT (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid())
        OR _inv.invited_by = auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'invitation non pending'; END IF;
  UPDATE public.shop_invitations SET email = lower(_new_email) WHERE id = _id;
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action, old_value, new_value)
    VALUES (auth.uid(), _inv.shop_id, 'change_invitation_email',
            jsonb_build_object('email', _inv.email), jsonb_build_object('email', _new_email));
END $$;

-- 5. Onboarding RPC
CREATE OR REPLACE FUNCTION public.onboarding_save_step(_shop_id uuid, _step text, _data jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_owner_bpei(auth.uid())
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _step IS NULL OR length(_step) > 40 THEN RAISE EXCEPTION 'étape invalide'; END IF;
  UPDATE public.shops
    SET onboarding_current_step = _step,
        onboarding_status = CASE WHEN onboarding_status = 'completed' THEN onboarding_status ELSE 'in_progress' END,
        onboarding_data = COALESCE(onboarding_data, '{}'::jsonb) || jsonb_build_object(_step, _data)
    WHERE id = _shop_id;
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_complete(_shop_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_owner_bpei(auth.uid())
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.shops SET onboarding_status = 'completed', onboarding_completed_at = now()
    WHERE id = _shop_id;
END $$;

CREATE OR REPLACE FUNCTION public.onboarding_skip_optional(_shop_id uuid, _step text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_owner_bpei(auth.uid())
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.shops
    SET onboarding_data = COALESCE(onboarding_data,'{}'::jsonb) || jsonb_build_object('_skipped_'||_step, true),
        onboarding_status = CASE WHEN onboarding_status = 'completed' THEN onboarding_status ELSE 'skipped_partially' END
    WHERE id = _shop_id;
END $$;

-- 6. RPC set_shop_media (sauvegarde du path après upload storage)
CREATE OR REPLACE FUNCTION public.set_shop_media(_shop_id uuid, _kind text, _path text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_owner_bpei(auth.uid())
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _path IS NOT NULL AND NOT (_path LIKE 'shops/'|| _shop_id::text ||'/%') THEN
    RAISE EXCEPTION 'chemin invalide';
  END IF;
  IF _kind = 'logo' THEN
    UPDATE public.shops SET public_logo_url = _path WHERE id = _shop_id;
  ELSIF _kind = 'cover' THEN
    UPDATE public.shops SET cover_image_url = _path WHERE id = _shop_id;
  ELSIF _kind = 'favicon' THEN
    UPDATE public.shops SET favicon_url = _path WHERE id = _shop_id;
  ELSIF _kind = 'social' THEN
    UPDATE public.shops SET social_share_image_url = _path WHERE id = _shop_id;
  ELSE
    RAISE EXCEPTION 'kind invalide';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.append_shop_gallery(_shop_id uuid, _path text, _alt text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_owner_bpei(auth.uid())
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT (_path LIKE 'shops/'|| _shop_id::text ||'/%') THEN RAISE EXCEPTION 'chemin invalide'; END IF;
  UPDATE public.shops
    SET gallery_images = COALESCE(gallery_images,'[]'::jsonb) ||
        jsonb_build_array(jsonb_build_object('path', _path, 'alt', COALESCE(_alt,''),
                                             'order', jsonb_array_length(COALESCE(gallery_images,'[]'::jsonb))))
    WHERE id = _shop_id;
END $$;

CREATE OR REPLACE FUNCTION public.remove_shop_gallery(_shop_id uuid, _path text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_owner_bpei(auth.uid())
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.shops
    SET gallery_images = COALESCE(
      (SELECT jsonb_agg(elem) FROM jsonb_array_elements(gallery_images) elem
        WHERE elem->>'path' <> _path), '[]'::jsonb)
    WHERE id = _shop_id;
END $$;

-- 7. RLS storage.objects sur bucket shop-public-media
-- Lecture : membre de la boutique OU patron BPEI (bucket privé, URL signée pour public)
DROP POLICY IF EXISTS "shop-public-media read" ON storage.objects;
CREATE POLICY "shop-public-media read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'shop-public-media'
    AND (
      public.is_owner_bpei(auth.uid())
      OR public.is_admin_bpei(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.shop_memberships m
        WHERE m.user_id = auth.uid()
          AND ('shops/' || m.shop_id::text || '/') = substr(name, 1, length('shops/' || m.shop_id::text || '/'))
      )
    )
  );

DROP POLICY IF EXISTS "shop-public-media write" ON storage.objects;
CREATE POLICY "shop-public-media write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-public-media'
    AND (
      public.is_owner_bpei(auth.uid())
      OR public.is_admin_bpei(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.shop_memberships m
        WHERE m.user_id = auth.uid()
          AND m.role IN ('shop_manager','network_owner')
          AND ('shops/' || m.shop_id::text || '/') = substr(name, 1, length('shops/' || m.shop_id::text || '/'))
      )
    )
  );

DROP POLICY IF EXISTS "shop-public-media update" ON storage.objects;
CREATE POLICY "shop-public-media update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shop-public-media' AND (
      public.is_owner_bpei(auth.uid())
      OR public.is_admin_bpei(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.shop_memberships m
        WHERE m.user_id = auth.uid()
          AND m.role IN ('shop_manager','network_owner')
          AND ('shops/' || m.shop_id::text || '/') = substr(name, 1, length('shops/' || m.shop_id::text || '/'))
      )
    )
  );

DROP POLICY IF EXISTS "shop-public-media delete" ON storage.objects;
CREATE POLICY "shop-public-media delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'shop-public-media' AND (
      public.is_owner_bpei(auth.uid())
      OR public.is_admin_bpei(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.shop_memberships m
        WHERE m.user_id = auth.uid()
          AND m.role IN ('shop_manager','network_owner')
          AND ('shops/' || m.shop_id::text || '/') = substr(name, 1, length('shops/' || m.shop_id::text || '/'))
      )
    )
  );