CREATE OR REPLACE FUNCTION public.partner_sign_agreement(_agreement_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ver RECORD; _status text;
BEGIN
  SELECT v.version_number, v.content_hash INTO _ver
  FROM public.partner_agreements a
  JOIN public.partner_agreement_versions v
    ON v.agreement_id = a.id AND v.version_number = a.current_version
  WHERE a.id = _agreement_id;
  IF _ver IS NULL THEN
    RAISE EXCEPTION 'Accord ou version courante introuvable';
  END IF;
  _status := public.partner_accept_agreement_version(_agreement_id, _ver.version_number, _ver.content_hash);
END $$;