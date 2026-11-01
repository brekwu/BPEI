-- Enable ONLY the reviewed read-only discovery RPC through the private schema.
-- All other private functions are individually revoked from anon, verified before this change.
ALTER FUNCTION public.search_active_partners(text,text,boolean,text) SECURITY INVOKER;
GRANT USAGE ON SCHEMA bpei_private TO anon;
GRANT EXECUTE ON FUNCTION bpei_private.search_active_partners(text,text,boolean,text)
 TO anon;
-- Avoid accidental PUBLIC EXECUTE on future private functions owned by the migration role.
ALTER DEFAULT PRIVILEGES IN SCHEMA bpei_private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- Restrict future direct anonymous invocation to the single reviewed discovery signature.
DO $$
DECLARE v_fn record;
BEGIN
 FOR v_fn IN SELECT p.oid::regprocedure::text AS signature
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='bpei_private'
 AND p.oid::regprocedure::text<>'bpei_private.search_active_partners(text,text,boolean,text)'
 LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon',v_fn.signature);
 END LOOP;
END $$;
