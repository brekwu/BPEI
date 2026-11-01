CREATE OR REPLACE FUNCTION public.advance_independent_request(
  p_request_id uuid, p_next_status text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_request public.independent_requests%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_request FROM public.independent_requests
   WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.independent_id <> (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Mission unavailable' USING ERRCODE='42501';
  END IF;
  IF NOT (
    (v_request.status='accepted' AND p_next_status='in_progress') OR
    (v_request.status='in_progress' AND p_next_status='completed')
  ) THEN
    RAISE EXCEPTION 'Invalid mission status transition' USING ERRCODE='22023';
  END IF;
  UPDATE public.independent_requests
   SET status=p_next_status, updated_at=now()
   WHERE id=p_request_id;
  RETURN p_next_status;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_independent_request(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.advance_independent_request(uuid,text) TO authenticated;
