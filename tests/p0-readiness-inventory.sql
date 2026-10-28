-- BPEI P0 prelaunch evidence inventory (read-only). Run on the dedicated project.
-- "EXTERNAL_EVIDENCE_REQUIRED" is NEVER considered a PASS.
-- This cannot prove SMTP delivery, a GoTrue hook enabled in Auth settings,
-- real user ownership or the commit currently deployed in Vercel.
WITH checks AS (
  SELECT 10 AS ordinal, 'first_admin' AS gate,
    CASE WHEN (SELECT count(*) FROM auth.users u JOIN public.independent_admins a ON a.user_id=u.id
               WHERE u.email_confirmed_at IS NOT NULL) >= 1
       THEN 'PRESENT_REQUIRES_REAL_LOGIN_TEST' ELSE 'MISSING' END AS status
  UNION ALL SELECT 20,'legal_documents_published',
    CASE WHEN EXISTS(
      SELECT 1 FROM public.bpei_launch_controls c
      JOIN public.bpei_legal_releases r ON r.version=c.legal_version
      WHERE c.id=true AND c.legal_documents_published=true
      AND (SELECT count(DISTINCT d.kind) FROM public.bpei_legal_documents d
           WHERE d.version=c.legal_version AND d.approved_at IS NOT NULL)=3
    ) THEN 'PUBLISHED_REQUIRES_HUMAN_LEGAL_APPROVAL' ELSE 'MISSING' END
  UNION ALL SELECT 30,'hook_sql_permissions',
    CASE WHEN to_regprocedure('bpei_private.before_bpei_user_created(jsonb)') IS NOT NULL
      AND has_schema_privilege('supabase_auth_admin','bpei_private','USAGE')
      AND has_function_privilege('supabase_auth_admin',
        'bpei_private.before_bpei_user_created(jsonb)','EXECUTE')
      AND NOT has_function_privilege('anon',
        'bpei_private.before_bpei_user_created(jsonb)','EXECUTE')
      THEN 'SQL_PREPARED_NOT_PROOF_OF_HOOK_ACTIVATION' ELSE 'MISSING' END
  UNION ALL SELECT 40,'auth_hook_enabled_in_gotrue','EXTERNAL_EVIDENCE_REQUIRED'
  UNION ALL SELECT 50,'external_smtp_delivery_and_confirm_email','EXTERNAL_EVIDENCE_REQUIRED'
  UNION ALL SELECT 60,'auth_redirect_url_allowlist_and_recovery','EXTERNAL_EVIDENCE_REQUIRED'
  UNION ALL SELECT 70,'real_three_account_auth_rls_acceptance','EXTERNAL_EVIDENCE_REQUIRED'
  UNION ALL SELECT 80,'latest_p0_commit_deployed_and_verified','EXTERNAL_EVIDENCE_REQUIRED'
  UNION ALL SELECT 90,'public_registration_state',
    CASE WHEN EXISTS(SELECT 1 FROM public.bpei_launch_controls
                     WHERE id=true AND independent_registration_enabled=false)
      THEN 'SAFELY_CLOSED' ELSE 'NOT_CLOSED_REVIEW_IMMEDIATELY' END
  UNION ALL SELECT 100,'public_intake_state',
    CASE WHEN NOT EXISTS(SELECT 1 FROM public.bpei_intake_flags WHERE enabled=true)
      THEN 'SAFELY_CLOSED' ELSE 'OPEN_REVIEW_IMMEDIATELY' END
)
SELECT gate,status FROM checks ORDER BY ordinal;