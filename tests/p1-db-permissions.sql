-- P1 security smoke test for Supabase SQL Editor.
-- Checks that access is denied for a hypothetical authenticated user
-- who is not listed in independent_admins. No records are created.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
DO $check$
DECLARE rejected boolean;
BEGIN
 IF (SELECT count(*) FROM public.independent_admins)<>0 THEN
   RAISE EXCEPTION 'Admin list was exposed to a technician';
 END IF;
 rejected:=false;
 BEGIN PERFORM public.bpei_admin_incident_statistics(30);
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Stats accepted a non-admin'; END IF;
 rejected:=false;
 BEGIN PERFORM public.bpei_admin_search_missions('', 'all','all',25,0);
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Mission search accepted a non-admin'; END IF;
 rejected:=false;
 BEGIN PERFORM public.manage_incident_escalation(
  '99999999-9999-4999-8999-999999999991'::uuid,'priority',
  'critical',NULL,'Test unauthorized priority change');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Incident escalation accepted a non-admin'; END IF;
END
$check$;
ROLLBACK;
