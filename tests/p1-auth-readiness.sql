-- BPEI read-only authentication release readiness inventory.
-- Execute with Supabase SQL editor. No account, email or legal settings are modified.
-- The existence of an Auth hook FUNCTION does not prove the Auth hook is ENABLED.
-- PostgreSQL cannot verify external SMTP delivery or Auth Redirect URL allowlists.
SELECT
 (SELECT count(*)::integer FROM auth.users) AS auth_users,
 (SELECT count(*)::integer FROM public.independent_admins) AS admins,
 (SELECT count(*)::integer FROM public.bpei_legal_documents) AS legal_documents,
 (SELECT count(*)::integer FROM public.bpei_legal_releases) AS legal_releases,
 (SELECT count(*)::integer FROM public.bpei_legal_acceptances) AS legal_acceptances,
 (SELECT count(*)::integer FROM public.independent_requests) AS missions,
 (SELECT count(*)::integer FROM public.bpei_mission_incidents) AS incidents,
 (SELECT legal_documents_published FROM public.bpei_launch_controls WHERE id=true) AS legal_published,
 (SELECT independent_registration_enabled FROM public.bpei_launch_controls WHERE id=true) AS registration_open,
 (SELECT legal_version FROM public.bpei_launch_controls WHERE id=true) AS legal_version,
 (SELECT count(*)::integer FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='bpei_private' AND p.proname='before_bpei_user_created') AS auth_hook_function_count;
