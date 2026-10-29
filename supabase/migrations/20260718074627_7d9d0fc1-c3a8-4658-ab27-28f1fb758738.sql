-- Fix SUPA_security_definer_view on public.shops_public
ALTER VIEW public.shops_public SET (security_invoker = true);

-- Column-level SELECT grant on shops for anon (whitelist, matches view definition)
GRANT SELECT (
  id, name, public_name, city, address, postal_code, phone, email, public_email,
  website, description, public_description, public_logo_url, cover_image_url,
  gallery_images, business_type, service_radius_km, covered_cities, covered_postal_codes,
  theme_primary_color, theme_accent_color, favicon_url, social_share_image_url,
  social_links, status, public_profile_status, travel_fee_policy,
  travel_fee_amount_cents, validated_at, updated_at
) ON public.shops TO anon;

-- RLS policy allowing anon to read only validated shops (through the view)
DROP POLICY IF EXISTS shops_public_view_anon_select ON public.shops;
CREATE POLICY shops_public_view_anon_select ON public.shops
  FOR SELECT TO anon
  USING (status = 'validated'::shop_status);

-- Ensure authenticated can also read through the view for validated shops
DROP POLICY IF EXISTS shops_public_view_auth_select ON public.shops;
CREATE POLICY shops_public_view_auth_select ON public.shops
  FOR SELECT TO authenticated
  USING (status = 'validated'::shop_status);

GRANT SELECT ON public.shops_public TO anon, authenticated;