-- BPEI P0 release gate (lecture seule) — 2026-10-29
-- Lancer dans Supabase SQL Editor, ne modifie aucune donnée.
select 'users' as check_name, count(*)::text as observed, (count(*) >= 2) as passes from auth.users
union all select 'admins', count(*)::text, count(*) >= 1 from public.independent_admins
union all select 'published_legal_releases', count(*)::text, count(*) >= 1 from public.bpei_legal_releases
union all select 'p0_attestations', count(*)::text, count(*) >= 1 from public.bpei_p0_attestations
union all select 'profile_rls', bool_and(relrowsecurity)::text, coalesce(bool_and(relrowsecurity),false)
  from pg_class where oid in ('public.independent_profiles'::regclass,'public.independent_applications'::regclass,'public.independent_requests'::regclass);
-- Exiger aussi un test E2E d'inscription/confirmation e-mail, isolation entre deux comptes,
-- candidature, décision admin, SMTP réel, pages légales HTTP 200, et mobile.
-- Cette requête n'atteste PAS ces tests d'application; ne pas ouvrir les formulaires si manquants.
