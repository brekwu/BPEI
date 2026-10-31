-- P0: prevent accidental approval/publication of draft legal content.
-- Server-side table constraint, not just a browser-side warning.
-- The operator must still review legal correctness independently.
CREATE OR REPLACE FUNCTION bpei_private.has_unresolved_legal_markers(p_content text)
RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT
SET search_path TO ''
AS $function$
 SELECT
  p_content ~* '\[[^]]{0,200}(à|a)[[:space:]]+(compléter|completer|valider|désigner|designer|confirmer|vérifier|verifier)[^]]{0,200}\]'
  OR p_content ~* '\[[^]]{0,200}(TODO|TBD|placeholder|to[[:space:]]+complete|to[[:space:]]+verify)[^]]{0,200}\]'
  OR p_content ~* '(brouillon[[:space:]]+non[[:space:]]+publiable|ne[[:space:]]+pas[[:space:]]+publier|texte[[:space:]]+provisoire)';
$function$;

REVOKE ALL ON FUNCTION bpei_private.has_unresolved_legal_markers(text)
FROM PUBLIC, anon, authenticated;

ALTER TABLE public.bpei_legal_documents
 ADD CONSTRAINT bpei_legal_content_without_draft_markers
 CHECK (content IS NOT NULL AND NOT bpei_private.has_unresolved_legal_markers(content));

COMMENT ON CONSTRAINT bpei_legal_content_without_draft_markers
ON public.bpei_legal_documents
IS 'Prevents storing draft placeholder legal content; does not attest legal validity or authorize publishing.';
