-- Vague 6 — Security hardening: shops, content_reports, platform_legal_settings

-- 1) SHOPS: create a strict public view and cut direct anon access
CREATE OR REPLACE VIEW public.shops_public
WITH (security_invoker = false) AS
SELECT
  id,
  name,
  public_name,
  city,
  address,
  postal_code,
  phone,
  email,
  public_email,
  website,
  description,
  public_description,
  public_logo_url,
  cover_image_url,
  gallery_images,
  business_type,
  service_radius_km,
  covered_cities,
  covered_postal_codes,
  theme_primary_color,
  theme_accent_color,
  favicon_url,
  social_share_image_url,
  social_links,
  status,
  public_profile_status,
  travel_fee_policy,
  travel_fee_amount_cents,
  validated_at,
  updated_at
FROM public.shops
WHERE status = 'validated'::shop_status;

-- Drop the permissive anon RLS policy and revoke column-level anon access on the base table
DROP POLICY IF EXISTS shops_public_validated_select ON public.shops;
REVOKE ALL ON public.shops FROM anon;

GRANT SELECT ON public.shops_public TO anon, authenticated;

-- 2) CONTENT_REPORTS: prevent falsification of system fields on public inserts
DROP POLICY IF EXISTS "anyone can report" ON public.content_reports;
CREATE POLICY content_reports_public_insert_strict
ON public.content_reports
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status IS NULL OR status = 'pending'
);
-- Server-side (submitContentReport) uses service_role and remains unaffected.

-- 3) PLATFORM_LEGAL_SETTINGS: remove broad public SELECT (public reads go through the SECURITY DEFINER RPC get_published_platform_legal_settings)
DROP POLICY IF EXISTS "read platform legal settings" ON public.platform_legal_settings;
REVOKE SELECT ON public.platform_legal_settings FROM anon;