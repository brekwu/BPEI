-- The public read-only search wrapper must execute with a constrained owner;
-- do not grant anon USAGE on the bpei_private schema to expose other functions.
REVOKE ALL ON FUNCTION bpei_private.search_active_partners(text,text,boolean,text)
 FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.search_active_partners(text,text,boolean,text)
 SECURITY DEFINER;
-- Search-path remains empty, all calls and selected relations are schema-qualified.
REVOKE ALL ON FUNCTION public.search_active_partners(text,text,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_active_partners(text,text,boolean,text)
 TO anon,authenticated;
