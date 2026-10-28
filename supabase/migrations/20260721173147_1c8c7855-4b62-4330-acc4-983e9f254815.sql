CREATE OR REPLACE FUNCTION public.is_ai_import_enabled()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  env text;
BEGIN
  BEGIN
    env := current_setting('bpei.runtime_env', true);
  EXCEPTION WHEN OTHERS THEN
    env := NULL;
  END;
  IF env IS NULL OR env NOT IN ('preview', 'production') THEN
    RETURN false;
  END IF;
  RETURN COALESCE(public.is_ai_import_enabled_env(env), false);
END;
$$;