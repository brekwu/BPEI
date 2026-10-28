CREATE TABLE IF NOT EXISTS public.verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN (
    'kbis','insurance','id_card','vat_certificate','domicile_proof','other'
  )),
  storage_path text NOT NULL,
  original_filename text,
  mime_type text,
  size_bytes integer,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','accepted','rejected')),
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_documents TO authenticated;
GRANT ALL ON public.verification_documents TO service_role;

ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verification_documents_shop_members ON public.verification_documents;
CREATE POLICY verification_documents_shop_members
ON public.verification_documents
FOR ALL
TO authenticated
USING (
  public.is_shop_member(shop_id, auth.uid())
  OR public.has_platform_role(auth.uid(), 'admin_bpei')
  OR public.has_platform_role(auth.uid(), 'owner_bpei')
)
WITH CHECK (
  public.is_shop_member(shop_id, auth.uid())
  OR public.has_platform_role(auth.uid(), 'owner_bpei')
);

CREATE INDEX IF NOT EXISTS idx_verification_documents_shop ON public.verification_documents(shop_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_status ON public.verification_documents(review_status);

DROP TRIGGER IF EXISTS trg_verification_documents_updated_at ON public.verification_documents;
CREATE TRIGGER trg_verification_documents_updated_at
BEFORE UPDATE ON public.verification_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.submit_verification_request(_shop_id uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM public.shop_memberships
             WHERE shop_id = _shop_id AND user_id = v_uid
               AND role IN ('shop_manager','network_owner'))
    OR EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND owner_user_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.verification_documents WHERE shop_id = _shop_id) THEN
    RAISE EXCEPTION 'Aucun document fourni';
  END IF;
  UPDATE public.shops
     SET verification_status = 'pending',
         verification_submitted_at = now(),
         verification_reviewed_at = NULL,
         verification_reviewed_by = NULL,
         verification_notes = COALESCE(_notes, verification_notes)
   WHERE id = _shop_id;
END $$;

CREATE OR REPLACE FUNCTION public.owner_review_verification(
  _shop_id uuid, _decision text, _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF NOT (public.has_platform_role(v_uid, 'owner_bpei') OR public.has_platform_role(v_uid, 'admin_bpei')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF _decision NOT IN ('verified','rejected','suspended','reset') THEN
    RAISE EXCEPTION 'Décision invalide';
  END IF;
  UPDATE public.shops
     SET verification_status = CASE _decision
           WHEN 'reset' THEN 'not_submitted'::public.verification_status
           ELSE _decision::public.verification_status END,
         verification_reviewed_at = now(),
         verification_reviewed_by = v_uid,
         verification_notes = COALESCE(_notes, verification_notes)
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, target_type, target_id, details)
  VALUES (v_uid, 'verification_' || _decision, 'shop', _shop_id, jsonb_build_object('notes', _notes));
END $$;

CREATE OR REPLACE FUNCTION public.owner_review_verification_document(
  _document_id uuid, _status text, _notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Non authentifié'; END IF;
  IF NOT (public.has_platform_role(v_uid, 'owner_bpei') OR public.has_platform_role(v_uid, 'admin_bpei')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  IF _status NOT IN ('pending','accepted','rejected') THEN
    RAISE EXCEPTION 'Statut invalide';
  END IF;
  UPDATE public.verification_documents
     SET review_status = _status,
         review_notes = COALESCE(_notes, review_notes),
         reviewed_by = v_uid,
         reviewed_at = now()
   WHERE id = _document_id;
END $$;

CREATE OR REPLACE FUNCTION public.public_get_shop_public_view(_shop_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE v_row record;
BEGIN
  SELECT id, name, public_name, description, public_description,
         business_type, verification_status,
         city, address, postal_code,
         phone, email, public_email, website,
         status, public_profile_status,
         public_logo_url, cover_image_url, gallery_images, social_links,
         theme_primary_color, theme_accent_color,
         service_radius_km, covered_cities, covered_postal_codes,
         travel_fee_policy, travel_fee_amount_cents
    INTO v_row
    FROM public.shops
   WHERE id = _shop_id
     AND status = 'validated'
     AND public_profile_status = 'published';

  IF v_row IS NULL THEN RETURN NULL; END IF;

  IF v_row.business_type = 'mobile_independent' THEN
    v_row.address := NULL;
    v_row.postal_code := NULL;
    v_row.city := NULL;
  END IF;

  RETURN to_jsonb(v_row) || jsonb_build_object(
    'verified', v_row.verification_status = 'verified'
  );
END $$;

CREATE OR REPLACE FUNCTION public.public_search_shops_v2(_q text DEFAULT '', _business_type text DEFAULT NULL, _limit int DEFAULT 40)
RETURNS TABLE (
  id uuid, name text, business_type public.business_type, verified boolean,
  city text, postal_code text, address text, phone text, description text,
  covered_cities text[], covered_postal_codes text[], service_radius_km int
) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, s.business_type,
         (s.verification_status = 'verified') AS verified,
         CASE WHEN s.business_type = 'mobile_independent' THEN NULL ELSE s.city END,
         CASE WHEN s.business_type = 'mobile_independent' THEN NULL ELSE s.postal_code END,
         CASE WHEN s.business_type = 'mobile_independent' THEN NULL ELSE s.address END,
         s.phone, s.description,
         s.covered_cities, s.covered_postal_codes, s.service_radius_km
    FROM public.shops s
   WHERE s.status = 'validated'
     AND s.public_profile_status = 'published'
     AND (_business_type IS NULL OR s.business_type::text = _business_type)
     AND (
       COALESCE(_q,'') = ''
       OR s.name ILIKE '%'||_q||'%'
       OR COALESCE(s.city,'') ILIKE '%'||_q||'%'
       OR EXISTS (SELECT 1 FROM unnest(s.covered_cities) c WHERE c ILIKE '%'||_q||'%')
       OR EXISTS (SELECT 1 FROM unnest(s.covered_postal_codes) p WHERE p ILIKE _q||'%')
     )
   ORDER BY (s.verification_status = 'verified') DESC, s.name
   LIMIT GREATEST(1, LEAST(_limit, 100));
END $$;

GRANT EXECUTE ON FUNCTION public.public_get_shop_public_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_search_shops_v2(text, text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_verification_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_review_verification(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_review_verification_document(uuid, text, text) TO authenticated;