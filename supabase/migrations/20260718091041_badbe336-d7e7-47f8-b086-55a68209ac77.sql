-- Durcissement content_reports : revoke direct INSERT anon/authenticated, force passage par RPC serveur
REVOKE INSERT ON public.content_reports FROM anon;
REVOKE INSERT ON public.content_reports FROM authenticated;
DROP POLICY IF EXISTS content_reports_public_insert_strict ON public.content_reports;

-- RPC publique unique, whitelist stricte des champs, valeurs système forcées côté serveur
CREATE OR REPLACE FUNCTION public.submit_public_content_report(
  p_category text,
  p_description text,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_target_url text DEFAULT NULL,
  p_target_shop_id uuid DEFAULT NULL,
  p_legal_basis text DEFAULT NULL,
  p_reporter_name text DEFAULT NULL,
  p_reporter_email text DEFAULT NULL,
  p_reporter_phone text DEFAULT NULL,
  p_good_faith boolean DEFAULT false
)
RETURNS TABLE(report_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_number text;
BEGIN
  IF NOT p_good_faith THEN
    RAISE EXCEPTION 'good_faith_required';
  END IF;
  IF p_category IS NULL OR length(trim(p_category)) = 0 OR length(p_category) > 50 THEN
    RAISE EXCEPTION 'invalid_category';
  END IF;
  IF p_description IS NULL OR length(trim(p_description)) < 10 OR length(p_description) > 5000 THEN
    RAISE EXCEPTION 'invalid_description';
  END IF;

  INSERT INTO public.content_reports (
    category, description, target_type, target_id, target_url, target_shop_id,
    legal_basis, reporter_name, reporter_email, reporter_phone,
    good_faith_declared, status,
    reporter_user_id, decision, decision_reason, decided_at, decided_by
  ) VALUES (
    trim(p_category), trim(p_description),
    NULLIF(trim(coalesce(p_target_type,'')), ''),
    NULLIF(trim(coalesce(p_target_id,'')), ''),
    NULLIF(trim(coalesce(p_target_url,'')), ''),
    p_target_shop_id,
    NULLIF(trim(coalesce(p_legal_basis,'')), ''),
    NULLIF(trim(coalesce(p_reporter_name,'')), ''),
    NULLIF(trim(coalesce(p_reporter_email,'')), ''),
    NULLIF(trim(coalesce(p_reporter_phone,'')), ''),
    true, 'received',
    auth.uid(), NULL, NULL, NULL, NULL
  )
  RETURNING content_reports.report_number INTO v_number;

  RETURN QUERY SELECT v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_content_report(text,text,text,text,text,uuid,text,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_content_report(text,text,text,text,text,uuid,text,text,text,text,boolean) TO anon, authenticated;