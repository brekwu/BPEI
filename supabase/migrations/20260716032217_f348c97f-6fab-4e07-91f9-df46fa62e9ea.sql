-- Fix: gen_random_bytes lives in the extensions schema but two functions had search_path='public' only,
-- breaking QR code generation (get_or_create_repair_token) and customer portal invitations
-- (create_customer_portal_invitation). Both feature areas were returning:
-- "function gen_random_bytes(integer) does not exist".

CREATE OR REPLACE FUNCTION public.get_or_create_repair_token(_repair_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE _shop UUID; _tok TEXT;
BEGIN
  SELECT shop_id INTO _shop FROM public.repairs WHERE id = _repair_id;
  IF _shop IS NULL THEN RAISE EXCEPTION 'repair not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT token INTO _tok FROM public.repair_public_tokens WHERE repair_id = _repair_id;
  IF _tok IS NOT NULL THEN RETURN _tok; END IF;
  _tok := replace(replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_'), '+', '-'), '=', '');
  INSERT INTO public.repair_public_tokens(shop_id, repair_id, token, created_by)
  VALUES (_shop, _repair_id, _tok, auth.uid());
  RETURN _tok;
END; $function$;

CREATE OR REPLACE FUNCTION public.create_customer_portal_invitation(_customer_id uuid, _expires_days integer DEFAULT 30)
 RETURNS TABLE(id uuid, token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  _token := encode(extensions.gen_random_bytes(24), 'base64');
  _token := replace(replace(replace(_token, '+', '-'), '/', '_'), '=', '');
  _exp := now() + make_interval(days => GREATEST(1, LEAST(365, COALESCE(_expires_days, 30))));
  INSERT INTO public.customer_portal_invitations(shop_id, customer_id, email, token, invited_by, expires_at)
    VALUES (_shop_id, _customer_id, _email, _token, auth.uid(), _exp)
    RETURNING customer_portal_invitations.id INTO _id;
  RETURN QUERY SELECT _id, _token, _exp;
END;
$function$;