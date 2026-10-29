CREATE OR REPLACE FUNCTION public.is_shop_member(_user uuid, _shop uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_memberships WHERE user_id = _user AND shop_id = _shop)
      OR EXISTS (SELECT 1 FROM public.shops WHERE id = _shop AND owner_user_id = _user)
$$;

INSERT INTO public.shop_memberships (shop_id, user_id, role)
SELECT s.id, s.owner_user_id, 'network_owner'::public.shop_role
FROM public.shops s
WHERE s.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.shop_memberships sm
    WHERE sm.shop_id = s.id AND sm.user_id = s.owner_user_id
  );

CREATE OR REPLACE FUNCTION public.ensure_owner_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_user_id IS NOT NULL THEN
    INSERT INTO public.shop_memberships (shop_id, user_id, role)
    VALUES (NEW.id, NEW.owner_user_id, 'network_owner'::public.shop_role)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shops_ensure_owner_membership ON public.shops;
CREATE TRIGGER trg_shops_ensure_owner_membership
  AFTER INSERT OR UPDATE OF owner_user_id ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_membership();