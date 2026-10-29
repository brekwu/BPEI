-- To apply to the NEW managed Supabase project ONLY after testing
-- server-only writes with SUPABASE_SERVICE_ROLE_KEY. Do not run on Lovable production.
-- Defence in depth: TRUNCATE is not protected by row-level security!
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
  public.technician_applications,
  public.intervention_requests
FROM anon, authenticated;

GRANT SELECT, UPDATE ON TABLE
  public.technician_applications,
  public.intervention_requests
TO authenticated;

-- The existing read/update policies already additionally require
-- admin_bpei or owner_bpei by public.has_platform_role(auth.uid(), ...).
-- No direct untrusted browser INSERT, DELETE, TRUNCATE, TRIGGER or REFERENCES.
-- The backend writer uses the service_role server-side key only.

DROP POLICY IF EXISTS "public can submit technician application"
  ON public.technician_applications;
DROP POLICY IF EXISTS "public can submit intervention request"
  ON public.intervention_requests;

COMMIT;
