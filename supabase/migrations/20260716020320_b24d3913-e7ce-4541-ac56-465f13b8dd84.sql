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
  IF _status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'Ce rendez-vous ne peut plus etre annule';
  END IF;
  UPDATE public.appointments
    SET status = 'cancelled',
        cancellation_reason = COALESCE(NULLIF(_reason, ''), 'Annule par le client'),
        cancelled_at = now()
    WHERE id = _appointment_id;
END;
$$;