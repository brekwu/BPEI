CREATE OR REPLACE FUNCTION public.owner_record_consumer_observation(
  p_publication_id uuid,
  p_consumer_key text,
  p_observed_version integer,
  p_status text,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_platform_role(auth.uid(), 'owner_bpei') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending','success','failed','skipped','not_applicable','retrying') THEN
    RAISE EXCEPTION 'Statut invalide' USING ERRCODE = '22023';
  END IF;
  UPDATE public.platform_settings_consumer_status
    SET observed_version = p_observed_version,
        status = p_status,
        last_error_code = CASE WHEN p_status = 'failed' THEN p_error_code ELSE NULL END,
        last_error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE NULL END,
        last_checked_at = now()
    WHERE publication_id = p_publication_id AND consumer_key = p_consumer_key;
END; $$;