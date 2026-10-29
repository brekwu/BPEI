-- ============================================================
-- LOT 1 — BUG CANDIDATURE + ATTRIBUTION DES RÔLES BPEI
-- ============================================================

-- 1) Le candidat doit pouvoir relire SA candidature (bug: aucune policy SELECT candidat)
CREATE POLICY "candidate reads own application"
  ON public.shop_applications
  FOR SELECT
  TO authenticated
  USING (
    linked_user_id = auth.uid()
    OR lower(contact_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );

-- 2) submit_shop_application lie désormais la candidature à l'utilisateur connecté
CREATE OR REPLACE FUNCTION public.submit_shop_application(_data jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ref text;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(_data->>'contact_email',''));
  v_existing uuid;
BEGIN
  -- Anti-doublon : refuser une nouvelle candidature si une non-terminale existe déjà
  SELECT id INTO v_existing
    FROM public.shop_applications
   WHERE lower(contact_email) = v_email
     AND status NOT IN ('refusee','archivee','acces_active')
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Une candidature est déjà en cours pour cet email (référence existante).'
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.shop_applications (
    contact_first_name, contact_last_name, contact_email, contact_phone,
    commercial_name, legal_name, legal_form, siren, siret, vat_number,
    address, postal_code, city, website, description,
    establishments_count, employees_count, main_services, message, consent_contact,
    business_type,
    covered_cities, covered_postal_codes, service_radius_km,
    travel_fee_policy, travel_fee_amount_cents,
    insurance_provider, insurance_policy_number,
    professional_experience_years,
    wants_partnerships, wants_subcontracting, wants_maintenance_contracts,
    users_count,
    linked_user_id
  ) VALUES (
    _data->>'contact_first_name', _data->>'contact_last_name',
    _data->>'contact_email', _data->>'contact_phone',
    _data->>'commercial_name', _data->>'legal_name', _data->>'legal_form',
    _data->>'siren', _data->>'siret', _data->>'vat_number',
    _data->>'address', _data->>'postal_code', _data->>'city',
    _data->>'website', _data->>'description',
    NULLIF(_data->>'establishments_count','')::int,
    NULLIF(_data->>'employees_count','')::int,
    _data->>'main_services', _data->>'message',
    COALESCE((_data->>'consent_contact')::boolean, false),
    COALESCE(NULLIF(_data->>'business_type','')::public.business_type, 'physical_shop'::public.business_type),
    CASE WHEN _data ? 'covered_cities' AND jsonb_typeof(_data->'covered_cities') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(_data->'covered_cities')) ELSE '{}'::text[] END,
    CASE WHEN _data ? 'covered_postal_codes' AND jsonb_typeof(_data->'covered_postal_codes') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(_data->'covered_postal_codes')) ELSE '{}'::text[] END,
    NULLIF(_data->>'service_radius_km','')::int,
    _data->>'travel_fee_policy',
    NULLIF(_data->>'travel_fee_amount_cents','')::int,
    _data->>'insurance_provider',
    _data->>'insurance_policy_number',
    NULLIF(_data->>'professional_experience_years','')::int,
    COALESCE((_data->>'wants_partnerships')::boolean, false),
    COALESCE((_data->>'wants_subcontracting')::boolean, false),
    COALESCE((_data->>'wants_maintenance_contracts')::boolean, false),
    NULLIF(_data->>'users_count','')::int,
    v_uid
  )
  RETURNING reference INTO v_ref;
  RETURN v_ref;
END
$function$;

-- 3) Backfill : rattacher les candidatures existantes à leur user Auth quand l'email correspond
UPDATE public.shop_applications sa
   SET linked_user_id = u.id
  FROM auth.users u
 WHERE sa.linked_user_id IS NULL
   AND lower(sa.contact_email) = lower(u.email);

-- 4) RPC de consultation "ma candidature" (source de vérité serveur)
CREATE OR REPLACE FUNCTION public.get_my_application()
 RETURNS SETOF public.shop_applications
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT sa.*
    FROM public.shop_applications sa
   WHERE auth.uid() IS NOT NULL
     AND (
       sa.linked_user_id = auth.uid()
       OR lower(sa.contact_email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
     )
   ORDER BY sa.created_at DESC
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_application() TO authenticated;

-- 5) Rôles plateforme en attente pour les emails sans compte Auth encore créé
CREATE TABLE IF NOT EXISTS public.pending_platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.platform_role NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, role)
);
GRANT SELECT, INSERT, DELETE ON public.pending_platform_roles TO authenticated;
GRANT ALL ON public.pending_platform_roles TO service_role;
ALTER TABLE public.pending_platform_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage pending roles"
  ON public.pending_platform_roles FOR ALL
  TO authenticated
  USING (public.is_owner_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()));

-- 6) Trigger : dès qu'un utilisateur Auth est créé, appliquer ses rôles en attente
CREATE OR REPLACE FUNCTION public.apply_pending_platform_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_platform_roles (user_id, role)
  SELECT NEW.id, ppr.role
    FROM public.pending_platform_roles ppr
   WHERE lower(ppr.email) = lower(NEW.email)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.pending_platform_roles
   WHERE lower(email) = lower(NEW.email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_pending_platform_roles_trg ON auth.users;
CREATE TRIGGER apply_pending_platform_roles_trg
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.apply_pending_platform_roles();

-- Rejouer aussi à la confirmation d'email (si email changé/confirmé plus tard)
DROP TRIGGER IF EXISTS apply_pending_platform_roles_on_confirm ON auth.users;
CREATE TRIGGER apply_pending_platform_roles_on_confirm
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.apply_pending_platform_roles();

-- 7) Attribution effective des rôles demandés
-- OWNER_BPEI (comptes existants)
INSERT INTO public.user_platform_roles (user_id, role)
SELECT u.id, 'owner_bpei'::public.platform_role
  FROM auth.users u
 WHERE lower(u.email) IN ('brekwu@gmail.com','ectoplasma1108@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- ADMIN_BPEI (comptes existants — actuellement aucun des 3 n'existe, mais idempotent)
INSERT INTO public.user_platform_roles (user_id, role)
SELECT u.id, 'admin_bpei'::public.platform_role
  FROM auth.users u
 WHERE lower(u.email) IN ('hutoonytb@gmail.com','hugopavio11@gmail.com','brekwuytb@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Pending pour les emails admins sans compte Auth
INSERT INTO public.pending_platform_roles (email, role)
VALUES
  ('hutoonytb@gmail.com', 'admin_bpei'),
  ('hugopavio11@gmail.com', 'admin_bpei'),
  ('brekwuytb@gmail.com', 'admin_bpei')
ON CONFLICT (email, role) DO NOTHING;

-- Nettoyer les pending devenus inutiles (si un compte existe maintenant, apply direct)
DELETE FROM public.pending_platform_roles ppr
 WHERE EXISTS (
   SELECT 1 FROM auth.users u
    WHERE lower(u.email) = lower(ppr.email)
      AND EXISTS (
        SELECT 1 FROM public.user_platform_roles upr
         WHERE upr.user_id = u.id AND upr.role = ppr.role
      )
 );