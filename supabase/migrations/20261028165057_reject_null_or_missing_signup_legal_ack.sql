-- Applied in the BPEI Supabase project after the initial hook migration.
-- SQL three-valued logic: when an acknowledgement key is missing, equality
-- returns NULL. The hook must reject NULL exactly like FALSE.
CREATE OR REPLACE FUNCTION bpei_private.has_current_signup_acknowledgement(
  p_event jsonb, p_version text
) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=''
AS $$
 SELECT COALESCE(
   p_version IS NOT NULL
   AND length(btrim(p_version)) >= 3
   AND p_event->'user'->'user_metadata'->>'bpei_legal_version_acknowledged' = p_version,
   FALSE
 );
$$;
REVOKE ALL ON FUNCTION bpei_private.has_current_signup_acknowledgement(jsonb,text)
 FROM PUBLIC,anon,authenticated;
