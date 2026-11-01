-- Supabase migration 20261028172500: suppress exact 10-minute duplicates and limit submissions to 5/email/24h.
-- This does not open the public contact/intervention intake flags.
CREATE OR REPLACE FUNCTION bpei_private.guard_bpei_inquiry_spam()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_email text:=lower(btrim(coalesce(NEW.email,'')));
BEGIN
 IF length(v_email)<5 THEN
  RAISE EXCEPTION 'Invalid sender' USING ERRCODE='22023';
 END IF;
 -- Serialize attempts from the same sender so parallel requests cannot evade limits.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bpei-inquiry:'||v_email,3810));
 IF EXISTS(
  SELECT 1 FROM public.bpei_inquiries i WHERE lower(btrim(i.email))=v_email
  AND i.kind=NEW.kind AND lower(btrim(i.subject))=lower(btrim(NEW.subject))
  AND btrim(i.description)=btrim(NEW.description) AND i.created_at>=now()-interval '10 minutes'
 ) THEN
  RAISE EXCEPTION 'Duplicate inquiry; use the existing request' USING ERRCODE='22023';
 END IF;
 IF (SELECT count(*) FROM public.bpei_inquiries i
     WHERE lower(btrim(i.email))=v_email AND i.created_at>=now()-interval '24 hours')>=5 THEN
  RAISE EXCEPTION 'Too many submissions; contact BPEI for assistance' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END $function$
;
REVOKE ALL ON FUNCTION bpei_private.guard_bpei_inquiry_spam() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_inquiry_spam_guard BEFORE INSERT ON public.bpei_inquiries
 FOR EACH ROW EXECUTE FUNCTION bpei_private.guard_bpei_inquiry_spam();
