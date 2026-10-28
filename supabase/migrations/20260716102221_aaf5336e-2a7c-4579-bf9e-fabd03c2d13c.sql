-- 1) Colonnes supplémentaires sur shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS theme_primary_color text,
  ADD COLUMN IF NOT EXISTS theme_accent_color text,
  ADD COLUMN IF NOT EXISTS publication_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS publication_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS publication_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS publication_notes text,
  ADD COLUMN IF NOT EXISTS legal_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS legal_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS legal_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS legal_notes text;

-- Contrainte de valeurs autorisées pour legal_status
DO $$ BEGIN
  ALTER TABLE public.shops
    ADD CONSTRAINT shops_legal_status_check
    CHECK (legal_status IN ('draft','submitted','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN check_violation THEN NULL; END $$;

-- 2) Horaires multi-plages : ajout slot_index et changement d'unicité
ALTER TABLE public.shop_business_hours
  ADD COLUMN IF NOT EXISTS slot_index smallint NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.shop_business_hours DROP CONSTRAINT shop_business_hours_shop_id_day_of_week_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.shop_business_hours
    ADD CONSTRAINT shop_business_hours_shop_day_slot_key UNIQUE (shop_id, day_of_week, slot_index);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) RPC : demander la publication (gérant)
CREATE OR REPLACE FUNCTION public.shop_request_publication(_shop_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_shop(auth.uid(), _shop_id) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  UPDATE public.shops
     SET public_profile_status = 'pending_review',
         publication_requested_at = now(),
         publication_notes = _notes,
         updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'shop.publication.request', 'shop', _shop_id, jsonb_build_object('notes', _notes));
END;
$$;

-- 4) RPC : approuver la publication (patron BPEI)
CREATE OR REPLACE FUNCTION public.owner_approve_publication(_shop_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_platform_role(auth.uid(),'owner_bpei') OR public.has_platform_role(auth.uid(),'admin_bpei')) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI';
  END IF;
  UPDATE public.shops
     SET public_profile_status = 'published',
         publication_reviewed_at = now(),
         publication_reviewed_by = auth.uid(),
         publication_notes = _notes,
         updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'shop.publication.approve', 'shop', _shop_id, jsonb_build_object('notes', _notes));
END;
$$;

-- 5) RPC : refuser la publication (patron BPEI)
CREATE OR REPLACE FUNCTION public.owner_reject_publication(_shop_id uuid, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_platform_role(auth.uid(),'owner_bpei') OR public.has_platform_role(auth.uid(),'admin_bpei')) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI';
  END IF;
  IF _notes IS NULL OR length(trim(_notes)) < 5 THEN
    RAISE EXCEPTION 'Un motif de refus est requis';
  END IF;
  UPDATE public.shops
     SET public_profile_status = 'draft',
         publication_reviewed_at = now(),
         publication_reviewed_by = auth.uid(),
         publication_notes = _notes,
         updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'shop.publication.reject', 'shop', _shop_id, jsonb_build_object('notes', _notes));
END;
$$;

-- 6) RPC : dépublier (gérant)
CREATE OR REPLACE FUNCTION public.shop_unpublish(_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_shop(auth.uid(), _shop_id) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  UPDATE public.shops
     SET public_profile_status = 'draft', updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'shop.publication.unpublish', 'shop', _shop_id, '{}'::jsonb);
END;
$$;

-- 7) RPC : soumettre le dossier juridique (gérant)
CREATE OR REPLACE FUNCTION public.shop_submit_legal(_shop_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_shop record;
BEGIN
  IF NOT public.can_manage_shop(auth.uid(), _shop_id) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  SELECT legal_name, legal_form, siret INTO v_shop FROM public.shops WHERE id = _shop_id;
  IF v_shop.legal_name IS NULL OR v_shop.legal_form IS NULL OR v_shop.siret IS NULL THEN
    RAISE EXCEPTION 'Raison sociale, forme et SIRET requis';
  END IF;
  UPDATE public.shops
     SET legal_status = 'submitted', legal_submitted_at = now(), legal_notes = NULL, updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'shop.legal.submit', 'shop', _shop_id, '{}'::jsonb);
END;
$$;

-- 8) RPC : approuver le dossier juridique (patron BPEI)
CREATE OR REPLACE FUNCTION public.owner_approve_legal(_shop_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_platform_role(auth.uid(),'owner_bpei') OR public.has_platform_role(auth.uid(),'admin_bpei')) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI';
  END IF;
  UPDATE public.shops
     SET legal_status = 'approved',
         legal_reviewed_at = now(),
         legal_reviewed_by = auth.uid(),
         legal_notes = _notes,
         updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'shop.legal.approve', 'shop', _shop_id, jsonb_build_object('notes', _notes));
END;
$$;

-- 9) RPC : refuser le dossier juridique
CREATE OR REPLACE FUNCTION public.owner_reject_legal(_shop_id uuid, _notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_platform_role(auth.uid(),'owner_bpei') OR public.has_platform_role(auth.uid(),'admin_bpei')) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI';
  END IF;
  IF _notes IS NULL OR length(trim(_notes)) < 5 THEN
    RAISE EXCEPTION 'Un motif de refus est requis';
  END IF;
  UPDATE public.shops
     SET legal_status = 'rejected',
         legal_reviewed_at = now(),
         legal_reviewed_by = auth.uid(),
         legal_notes = _notes,
         updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'shop.legal.reject', 'shop', _shop_id, jsonb_build_object('notes', _notes));
END;
$$;

-- 10) RPC : remplacer toutes les plages horaires en une fois (gérant)
CREATE OR REPLACE FUNCTION public.shop_replace_business_hours(_shop_id uuid, _slots jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.can_manage_shop(auth.uid(), _shop_id) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  DELETE FROM public.shop_business_hours WHERE shop_id = _shop_id;
  IF _slots IS NULL OR jsonb_typeof(_slots) <> 'array' THEN RETURN; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_slots) LOOP
    INSERT INTO public.shop_business_hours
      (shop_id, day_of_week, slot_index, opens_at, closes_at, is_closed)
    VALUES (
      _shop_id,
      (r->>'day_of_week')::smallint,
      COALESCE((r->>'slot_index')::smallint, 0),
      NULLIF(r->>'opens_at','')::time,
      NULLIF(r->>'closes_at','')::time,
      COALESCE((r->>'is_closed')::boolean, false)
    );
  END LOOP;
END;
$$;

-- 11) Publication : restreindre la vue publique aux boutiques publiées
-- (public_get_shop_payment_methods et publicGetShopStorefront filtrent déjà sur status='validated' ;
--  on ajoute la contrainte public_profile_status='published' via une nouvelle RPC.)
CREATE OR REPLACE FUNCTION public.public_shop_is_published(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
     WHERE id = _shop_id
       AND status = 'validated'
       AND public_profile_status = 'published'
  );
$$;
GRANT EXECUTE ON FUNCTION public.public_shop_is_published(uuid) TO anon, authenticated;