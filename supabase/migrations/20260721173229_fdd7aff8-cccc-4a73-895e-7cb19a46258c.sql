DO $$
DECLARE r boolean;
BEGIN
  -- T1: preview=true, prod=false, runtime=preview -> true
  UPDATE public.platform_feature_flags SET enabled=true WHERE feature_key='ai_import_enabled' AND environment='preview';
  UPDATE public.platform_feature_flags SET enabled=false WHERE feature_key='ai_import_enabled' AND environment='production';
  PERFORM set_config('bpei.runtime_env', 'preview', true);
  r := public.is_ai_import_enabled();
  RAISE NOTICE 'T1 preview=T prod=F rt=preview => % (expected true)', r;
  IF r IS NOT TRUE THEN RAISE EXCEPTION 'T1 FAILED'; END IF;

  -- T2: preview=true, prod=false, runtime=production -> false
  PERFORM set_config('bpei.runtime_env', 'production', true);
  r := public.is_ai_import_enabled();
  RAISE NOTICE 'T2 preview=T prod=F rt=production => % (expected false)', r;
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'T2 FAILED'; END IF;

  -- T3: preview=false, prod=true, runtime=preview -> false
  UPDATE public.platform_feature_flags SET enabled=false WHERE feature_key='ai_import_enabled' AND environment='preview';
  UPDATE public.platform_feature_flags SET enabled=true WHERE feature_key='ai_import_enabled' AND environment='production';
  PERFORM set_config('bpei.runtime_env', 'preview', true);
  r := public.is_ai_import_enabled();
  RAISE NOTICE 'T3 preview=F prod=T rt=preview => % (expected false)', r;
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'T3 FAILED'; END IF;

  -- T4: runtime inconnu -> false
  PERFORM set_config('bpei.runtime_env', '', true);
  r := public.is_ai_import_enabled();
  RAISE NOTICE 'T4 rt=unknown => % (expected false)', r;
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'T4 FAILED'; END IF;

  -- Restore initial state: both false
  UPDATE public.platform_feature_flags SET enabled=false WHERE feature_key='ai_import_enabled';
  RAISE NOTICE 'ALL TESTS PASSED — flags reset to false/false';
END $$;