-- Apply only AFTER production server uses SUPABASE_SERVICE_ROLE_KEY for these writes.
-- Safe additive security hardening; no user data deletion.
BEGIN;
REVOKE INSERT ON public.technician_applications FROM anon, authenticated;
REVOKE INSERT ON public.intervention_requests FROM anon, authenticated;
DROP POLICY IF EXISTS "public can submit technician application" ON public.technician_applications;
DROP POLICY IF EXISTS "public can submit intervention request" ON public.intervention_requests;
COMMIT;
