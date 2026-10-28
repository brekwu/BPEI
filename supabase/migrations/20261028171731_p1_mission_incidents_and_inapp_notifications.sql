-- BPEI P1 (2026-10-28): incidents, anti-abuse guard, internal notifications.
-- Schema mirrors migration already applied to the private Supabase preproduction project.
CREATE TABLE public.bpei_mission_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES public.independent_requests(id) ON DELETE RESTRICT,
 reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
 category text NOT NULL CHECK (category IN ('client_unreachable','technical','safety','other')),
 description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 30 AND 2000),
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','resolved')),
 resolution_note text CHECK (resolution_note IS NULL OR char_length(btrim(resolution_note)) BETWEEN 10 AND 2000),
 reviewed_by uuid REFERENCES auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bpei_incidents_by_mission ON public.bpei_mission_incidents(request_id,created_at DESC);
CREATE INDEX bpei_incidents_by_status ON public.bpei_mission_incidents(status,created_at DESC);
CREATE UNIQUE INDEX bpei_one_active_incident_per_mission ON public.bpei_mission_incidents(request_id)
 WHERE status IN ('open','under_review');
ALTER TABLE public.bpei_mission_incidents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_mission_incidents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_mission_incidents TO authenticated;
GRANT INSERT (request_id,category,description) ON public.bpei_mission_incidents TO authenticated;
CREATE POLICY bpei_incident_read_owner_admin ON public.bpei_mission_incidents FOR SELECT TO authenticated USING(
 reporter_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.independent_admins adm WHERE adm.user_id=(SELECT auth.uid()))
);
CREATE POLICY bpei_incident_create_owner_active_mission ON public.bpei_mission_incidents
 FOR INSERT TO authenticated WITH CHECK(
 reporter_id=(SELECT auth.uid()) AND status='open'
 AND EXISTS(SELECT 1 FROM public.independent_requests r WHERE r.id=request_id
  AND r.independent_id=(SELECT auth.uid()) AND r.status IN ('accepted','in_progress'))
);
CREATE TABLE public.bpei_notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('mission_assigned','mission_status','incident_opened','incident_status')),
 title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 160),
 mission_id uuid REFERENCES public.independent_requests(id) ON DELETE SET NULL,
 incident_id uuid REFERENCES public.bpei_mission_incidents(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX bpei_notification_inbox ON public.bpei_notifications(recipient_id,created_at DESC);
ALTER TABLE public.bpei_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_notifications TO authenticated;
CREATE POLICY bpei_notifications_owner_read ON public.bpei_notifications FOR SELECT TO authenticated
 USING (recipient_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION bpei_private.bpei_incident_rate_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF NEW.reporter_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'Reporter must own the incident' USING ERRCODE='42501';
 END IF;
 -- Serialize this reporter's creates to avoid parallel rate-limit races.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.reporter_id::text,215341));
 IF (SELECT count(*) FROM public.bpei_mission_incidents
     WHERE reporter_id=NEW.reporter_id AND created_at>now()-interval '24 hours')>=3 THEN
   RAISE EXCEPTION 'Incident report limit reached; contact administration' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END $function$
;
REVOKE ALL ON FUNCTION bpei_private.bpei_incident_rate_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_incident_rate_limit BEFORE INSERT ON public.bpei_mission_incidents
 FOR EACH ROW EXECUTE FUNCTION bpei_private.bpei_incident_rate_guard();
CREATE OR REPLACE FUNCTION bpei_private.bpei_notify_mission_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='INSERT' THEN
   INSERT INTO public.bpei_notifications(recipient_id,kind,title,mission_id)
   VALUES(NEW.independent_id,'mission_assigned','Nouvelle mission proposée',NEW.id);
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
   INSERT INTO public.bpei_notifications(recipient_id,kind,title,mission_id)
   VALUES(NEW.independent_id,'mission_status','Le statut de votre mission a changé',NEW.id);
 END IF;
 RETURN NEW;
END $function$
;
REVOKE ALL ON FUNCTION bpei_private.bpei_notify_mission_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_notify_mission_change AFTER INSERT OR UPDATE OF status ON public.independent_requests
 FOR EACH ROW EXECUTE FUNCTION bpei_private.bpei_notify_mission_change();
CREATE OR REPLACE FUNCTION bpei_private.bpei_notify_incident_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='INSERT' THEN
   INSERT INTO public.bpei_notifications(recipient_id,kind,title,mission_id,incident_id)
   SELECT adm.user_id,'incident_opened','Un incident de mission a été signalé',NEW.request_id,NEW.id
   FROM public.independent_admins adm;
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
   INSERT INTO public.bpei_notifications(recipient_id,kind,title,mission_id,incident_id)
   VALUES(NEW.reporter_id,'incident_status','Suivi de votre incident mis à jour',NEW.request_id,NEW.id);
 END IF;
 RETURN NEW;
END $function$
;
REVOKE ALL ON FUNCTION bpei_private.bpei_notify_incident_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_notify_incident_change AFTER INSERT OR UPDATE OF status ON public.bpei_mission_incidents
 FOR EACH ROW EXECUTE FUNCTION bpei_private.bpei_notify_incident_change();
CREATE OR REPLACE FUNCTION bpei_private.review_bpei_incident(p_incident_id uuid, p_next_status text, p_resolution text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid:=auth.uid(); v_row public.bpei_mission_incidents%ROWTYPE;
BEGIN
 IF v_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.independent_admins WHERE user_id=v_id
 ) THEN RAISE EXCEPTION 'BPEI admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_row FROM public.bpei_mission_incidents WHERE id=p_incident_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found' USING ERRCODE='P0002'; END IF;
 IF NOT (
  (v_row.status='open' AND p_next_status IN ('under_review','resolved'))
  OR (v_row.status='under_review' AND p_next_status='resolved')
 ) THEN RAISE EXCEPTION 'Invalid incident transition' USING ERRCODE='22023'; END IF;
 IF p_next_status='resolved' AND char_length(btrim(coalesce(p_resolution,''))) NOT BETWEEN 10 AND 2000 THEN
  RAISE EXCEPTION 'Resolution note required (10-2000 characters)' USING ERRCODE='22023';
 END IF;
 UPDATE public.bpei_mission_incidents
 SET status=p_next_status,resolution_note=CASE WHEN p_next_status='resolved' THEN btrim(p_resolution) ELSE NULL END,
     reviewed_by=v_id,reviewed_at=now(),updated_at=now()
 WHERE id=p_incident_id;
 RETURN jsonb_build_object('id',p_incident_id,'status',p_next_status);
END $function$
;
REVOKE ALL ON FUNCTION bpei_private.review_bpei_incident(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.review_bpei_incident(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.review_bpei_incident(p_incident_id uuid, p_next_status text, p_resolution text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT bpei_private.review_bpei_incident(p_incident_id,p_next_status,p_resolution) $function$
;
REVOKE ALL ON FUNCTION public.review_bpei_incident(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_bpei_incident(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION bpei_private.mark_bpei_notification_read(p_notification_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_id uuid:=auth.uid(); v_found boolean;
BEGIN
 IF v_id IS NULL THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 UPDATE public.bpei_notifications SET read_at=coalesce(read_at,now())
 WHERE id=p_notification_id AND recipient_id=v_id;
 GET DIAGNOSTICS v_found = ROW_COUNT;
 RETURN v_found;
END $function$
;
REVOKE ALL ON FUNCTION bpei_private.mark_bpei_notification_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mark_bpei_notification_read(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.mark_bpei_notification_read(p_notification_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SET search_path TO ''
AS $function$ SELECT bpei_private.mark_bpei_notification_read(p_notification_id) $function$
;
REVOKE ALL ON FUNCTION public.mark_bpei_notification_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mark_bpei_notification_read(uuid) TO authenticated;
