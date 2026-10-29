-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.business_type AS ENUM ('physical_shop','mobile_independent','hybrid_business','multi_location_network');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('not_submitted','pending','verified','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend subscription_plan enum (non destructif). ALTER TYPE ... ADD VALUE must run outside a transaction block for some Postgres versions,
-- but Supabase migrations run each statement so we use IF NOT EXISTS.
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'shop_essential';
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'shop_pro';
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'shop_network';
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'independent_intervention';
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'independent_partner';

-- 3. shops: business_type + private address + verification + public independent fields
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS business_type public.business_type NOT NULL DEFAULT 'physical_shop',
  ADD COLUMN IF NOT EXISTS private_address text,
  ADD COLUMN IF NOT EXISTS private_city text,
  ADD COLUMN IF NOT EXISTS private_postal_code text,
  ADD COLUMN IF NOT EXISTS verification_status public.verification_status NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS service_radius_km integer,
  ADD COLUMN IF NOT EXISTS covered_cities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS covered_postal_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS travel_fee_policy text,
  ADD COLUMN IF NOT EXISTS travel_fee_amount_cents integer,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS insurance_expires_on date;

-- 4. shop_subscriptions: beta_target_plan
ALTER TABLE public.shop_subscriptions
  ADD COLUMN IF NOT EXISTS beta_target_plan public.subscription_plan;

-- 5. shop_applications: business_type + independent fields
ALTER TABLE public.shop_applications
  ADD COLUMN IF NOT EXISTS business_type public.business_type NOT NULL DEFAULT 'physical_shop',
  ADD COLUMN IF NOT EXISTS covered_cities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS covered_postal_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_radius_km integer,
  ADD COLUMN IF NOT EXISTS travel_fee_policy text,
  ADD COLUMN IF NOT EXISTS travel_fee_amount_cents integer,
  ADD COLUMN IF NOT EXISTS insurance_provider text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number text,
  ADD COLUMN IF NOT EXISTS professional_experience_years integer,
  ADD COLUMN IF NOT EXISTS wants_partnerships boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_subcontracting boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wants_maintenance_contracts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS users_count integer;

-- 6. Restrict public shops SELECT — extend allowed columns.
-- Grant SELECT on the new public-safe columns to anon; deny on private ones.
-- shops already has narrow anon grants from a previous migration; add business_type + public independent fields.
GRANT SELECT (business_type, service_radius_km, covered_cities, covered_postal_codes, travel_fee_policy, travel_fee_amount_cents)
  ON public.shops TO anon;

-- Explicit REVOKE on private columns to make the intent explicit even if a prior blanket grant existed.
REVOKE SELECT (private_address, private_city, private_postal_code,
               verification_notes, insurance_provider, insurance_policy_number, insurance_expires_on)
  ON public.shops FROM anon;

-- 7. Comment for maintainers
COMMENT ON COLUMN public.shops.business_type IS 'Type d''activité: boutique physique, indépendant à domicile, hybride, réseau multi-établissements';
COMMENT ON COLUMN public.shops.private_address IS 'Adresse administrative privée (indépendant) — jamais exposée à anon';
COMMENT ON COLUMN public.shops.verification_status IS 'Statut de vérification BPEI, indépendant de l''abonnement';
COMMENT ON COLUMN public.shop_subscriptions.beta_target_plan IS 'Offre cible après fin de bêta. Activation manuelle par le patron BPEI — jamais de prélèvement auto';