-- 1) Fix mutable search_path on enforce_po_supplier_frozen
CREATE OR REPLACE FUNCTION public.enforce_po_supplier_frozen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF OLD.supplier_id IS DISTINCT FROM NEW.supplier_id
     AND OLD.status NOT IN ('draft') THEN
    RAISE EXCEPTION 'supplier cannot be changed on a % purchase order', OLD.status;
  END IF;
  RETURN NEW;
END $function$;

-- 2) Tighten shop_applications INSERT policies (replace WITH CHECK (true))
DROP POLICY IF EXISTS "anon submit application" ON public.shop_applications;
DROP POLICY IF EXISTS "auth submit application" ON public.shop_applications;

CREATE POLICY "anon submit application"
ON public.shop_applications
FOR INSERT
TO anon
WITH CHECK (
  status = 'nouvelle'
  AND shop_id IS NULL
  AND linked_user_id IS NULL
  AND internal_notes IS NULL
  AND consent_contact = true
  AND contact_email IS NOT NULL AND length(btrim(contact_email)) > 3
  AND contact_first_name IS NOT NULL AND length(btrim(contact_first_name)) > 0
  AND contact_last_name IS NOT NULL AND length(btrim(contact_last_name)) > 0
  AND commercial_name IS NOT NULL AND length(btrim(commercial_name)) > 0
);

CREATE POLICY "auth submit application"
ON public.shop_applications
FOR INSERT
TO authenticated
WITH CHECK (
  status = 'nouvelle'
  AND shop_id IS NULL
  AND internal_notes IS NULL
  AND (linked_user_id IS NULL OR linked_user_id = auth.uid())
  AND consent_contact = true
  AND contact_email IS NOT NULL AND length(btrim(contact_email)) > 3
  AND contact_first_name IS NOT NULL AND length(btrim(contact_first_name)) > 0
  AND contact_last_name IS NOT NULL AND length(btrim(contact_last_name)) > 0
  AND commercial_name IS NOT NULL AND length(btrim(commercial_name)) > 0
);

-- 3) Restrict public visibility of shop_business_hours to validated + published shops
DROP POLICY IF EXISTS "Horaires publics" ON public.shop_business_hours;

CREATE POLICY "Horaires publics"
ON public.shop_business_hours
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = shop_business_hours.shop_id
      AND s.status = 'validated'
      AND s.public_profile_status = 'published'
  )
);