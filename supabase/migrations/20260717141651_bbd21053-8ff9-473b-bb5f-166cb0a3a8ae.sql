-- 1) SHOPS: restrict anon column access to public-facing fields only.
--    Keep the existing anon RLS policies (they gate rows to status='validated'),
--    but strip column privileges so internal/legal fields cannot be projected.
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (
  id,
  name,
  public_name,
  description,
  public_description,
  city,
  address,
  postal_code,
  phone,
  email,
  public_email,
  website,
  status,
  public_profile_status,
  public_logo_url,
  cover_image_url,
  gallery_images,
  social_links,
  theme_primary_color,
  theme_accent_color,
  favicon_url,
  social_share_image_url,
  updated_at
) ON public.shops TO anon;

-- 2) REVIEWS: remove the broad anon SELECT policy. Public listings go through
--    the SECURITY DEFINER RPC list_shop_public_reviews which only returns
--    safe columns (rating/comment/author_name/…). Shop members and admins
--    keep full access through their existing policies.
DROP POLICY IF EXISTS "Avis publies publics" ON public.reviews;
REVOKE SELECT ON public.reviews FROM anon;