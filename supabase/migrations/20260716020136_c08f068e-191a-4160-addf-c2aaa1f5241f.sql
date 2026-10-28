CREATE TABLE IF NOT EXISTS public.customer_portal_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_portal_invitations TO authenticated;
GRANT ALL ON public.customer_portal_invitations TO service_role;
ALTER TABLE public.customer_portal_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres voient invitations portail" ON public.customer_portal_invitations FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Gerants creent invitations portail" ON public.customer_portal_invitations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id) AND invited_by = auth.uid());
CREATE POLICY "Gerants modifient invitations portail" ON public.customer_portal_invitations FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "Gerants suppriment invitations portail" ON public.customer_portal_invitations FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));
CREATE INDEX IF NOT EXISTS idx_cpi_customer ON public.customer_portal_invitations(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpi_token ON public.customer_portal_invitations(token);
CREATE INDEX IF NOT EXISTS idx_cpi_email ON public.customer_portal_invitations(lower(email));

CREATE OR REPLACE FUNCTION public.create_customer_portal_invitation(
  _customer_id UUID,
  _expires_days INTEGER DEFAULT 30
)
RETURNS TABLE(id UUID, token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _shop_id UUID;
  _email TEXT;
  _token TEXT;
  _id UUID;
  _exp TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
  SELECT c.shop_id, lower(c.email) INTO _shop_id, _email
    FROM public.customers c WHERE c.id = _customer_id;
  IF _shop_id IS NULL THEN RAISE EXCEPTION 'Client introuvable'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _shop_id) THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;
  IF _email IS NULL OR _email = '' THEN
    RAISE EXCEPTION 'Ce client n a pas d email. Ajoutez un email avant d inviter.';
  END IF;
  _token := encode(gen_random_bytes(24), 'base64');
  _token := replace(replace(replace(_token, '+', '-'), '/', '_'), '=', '');
  _exp := now() + make_interval(days => GREATEST(1, LEAST(365, COALESCE(_expires_days, 30))));
  INSERT INTO public.customer_portal_invitations(shop_id, customer_id, email, token, invited_by, expires_at)
    VALUES (_shop_id, _customer_id, _email, _token, auth.uid(), _exp)
    RETURNING customer_portal_invitations.id INTO _id;
  RETURN QUERY SELECT _id, _token, _exp;
END;
$$;
REVOKE ALL ON FUNCTION public.create_customer_portal_invitation(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_customer_portal_invitation(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_customer_portal_invitation(_invitation_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
  SELECT shop_id INTO _shop FROM public.customer_portal_invitations WHERE id = _invitation_id;
  IF _shop IS NULL THEN RETURN; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _shop) THEN RAISE EXCEPTION 'Acces refuse'; END IF;
  UPDATE public.customer_portal_invitations
    SET status = 'revoked'
    WHERE id = _invitation_id AND status = 'pending';
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_customer_portal_invitation(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_customer_portal_invitation(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_customer_portal_invitation(_token TEXT)
RETURNS TABLE(shop_id UUID, customer_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inv public.customer_portal_invitations%ROWTYPE;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Vous devez etre connecte'; END IF;
  SELECT * INTO _inv FROM public.customer_portal_invitations WHERE token = _token FOR UPDATE;
  IF _inv.id IS NULL THEN RAISE EXCEPTION 'Invitation introuvable'; END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation deja utilisee ou revoquee'; END IF;
  IF _inv.expires_at < now() THEN
    UPDATE public.customer_portal_invitations SET status = 'expired' WHERE id = _inv.id;
    RAISE EXCEPTION 'Invitation expiree';
  END IF;
  INSERT INTO public.customer_portal_links(user_id, shop_id, customer_id, linked_via)
    VALUES (_uid, _inv.shop_id, _inv.customer_id, 'invite')
    ON CONFLICT (user_id, customer_id) DO NOTHING;
  UPDATE public.customer_portal_invitations
    SET status = 'accepted', accepted_at = now(), accepted_by = _uid
    WHERE id = _inv.id;
  RETURN QUERY SELECT _inv.shop_id, _inv.customer_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_customer_portal_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_customer_portal_invitation(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.portal_cancel_appointment(_appointment_id UUID, _reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID := auth.uid();
  _cust UUID;
  _status TEXT;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Non authentifie'; END IF;
  SELECT a.customer_id, a.status::text INTO _cust, _status
    FROM public.appointments a WHERE a.id = _appointment_id;
  IF _cust IS NULL THEN RAISE EXCEPTION 'Rendez-vous introuvable'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customer_portal_links l
    WHERE l.customer_id = _cust AND l.user_id = _uid
  ) THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;
  IF _status NOT IN ('requested','confirmed') THEN
    RAISE EXCEPTION 'Ce rendez-vous ne peut plus etre annule';
  END IF;
  UPDATE public.appointments
    SET status = 'cancelled',
        cancellation_reason = COALESCE(NULLIF(_reason, ''), 'Annule par le client'),
        cancelled_at = now()
    WHERE id = _appointment_id;
END;
$$;
REVOKE ALL ON FUNCTION public.portal_cancel_appointment(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cancel_appointment(UUID, TEXT) TO authenticated;