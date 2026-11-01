-- BPEI P1: incident escalations; applied in preproduction as 20261028174135.
-- Only verified BPEI admins can assign incidents or change their priority.
ALTER TABLE public.bpei_mission_incidents
 ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
 ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS target_at timestamptz,
 ADD COLUMN IF NOT EXISTS escalation_reason text;
ALTER TABLE public.bpei_mission_incidents
 ADD CONSTRAINT bpei_incident_priority_allowed CHECK(priority IN ('low','normal','high','critical')),
 ADD CONSTRAINT bpei_incident_escalation_reason_length CHECK(
  escalation_reason IS NULL OR char_length(btrim(escalation_reason)) BETWEEN 10 AND 500
 );
UPDATE public.bpei_mission_incidents
 SET target_at=created_at+interval '48 hours' WHERE target_at IS NULL;
ALTER TABLE public.bpei_mission_incidents
 ALTER COLUMN target_at SET DEFAULT (now()+interval '48 hours'),
 ALTER COLUMN target_at SET NOT NULL;
CREATE INDEX bpei_incidents_escalations_queue
 ON public.bpei_mission_incidents(status,priority,target_at,created_at)
 WHERE status IN ('open','under_review');
CREATE INDEX bpei_incidents_assigned_admin_queue
 ON public.bpei_mission_incidents(assigned_admin_id,target_at)
 WHERE status IN ('open','under_review');

CREATE TABLE public.bpei_incident_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 incident_id uuid NOT NULL REFERENCES public.bpei_mission_incidents(id) ON DELETE RESTRICT,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 event_kind text NOT NULL CHECK(event_kind IN ('created','priority','assigned','unassigned','status')),
 previous_priority text,new_priority text,previous_status text,new_status text,
 previous_assignee uuid,new_assignee uuid,reason text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX bpei_incident_events_by_incident ON public.bpei_incident_events(incident_id,created_at,id);
ALTER TABLE public.bpei_incident_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_incident_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_incident_events TO authenticated;
CREATE POLICY bpei_incident_events_reporter_or_admin ON public.bpei_incident_events
 FOR SELECT TO authenticated USING(
  EXISTS(SELECT 1 FROM public.bpei_mission_incidents incident
   WHERE incident.id=incident_id AND (
    incident.reporter_id=(SELECT auth.uid())
    OR EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
   )
  )
 );

ALTER TABLE public.bpei_notifications DROP CONSTRAINT IF EXISTS bpei_notifications_kind_check;
ALTER TABLE public.bpei_notifications ADD CONSTRAINT bpei_notifications_kind_check CHECK(
 kind IN ('mission_assigned','mission_status','incident_opened','incident_status','incident_assigned','incident_escalated')
);
CREATE OR REPLACE FUNCTION bpei_private.record_incident_escalation_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.bpei_incident_events(
    incident_id,actor_id,event_kind,new_priority,new_status,new_assignee
  ) VALUES(NEW.id,auth.uid(),'created',NEW.priority,NEW.status,NEW.assigned_admin_id);
 ELSE
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
   INSERT INTO public.bpei_incident_events(
    incident_id,actor_id,event_kind,previous_priority,new_priority,reason
   ) VALUES(NEW.id,auth.uid(),'priority',OLD.priority,NEW.priority,NEW.escalation_reason);
   IF NEW.priority='critical' THEN
    INSERT INTO public.bpei_notifications(recipient_id,kind,title,mission_id,incident_id)
    SELECT admin.user_id,'incident_escalated','Incident critique à traiter',NEW.request_id,NEW.id
    FROM public.independent_admins admin;
   END IF;
  END IF;
  IF NEW.assigned_admin_id IS DISTINCT FROM OLD.assigned_admin_id THEN
   INSERT INTO public.bpei_incident_events(
    incident_id,actor_id,event_kind,previous_assignee,new_assignee,reason
   ) VALUES(NEW.id,auth.uid(),
      CASE WHEN NEW.assigned_admin_id IS NULL THEN 'unassigned' ELSE 'assigned' END,
      OLD.assigned_admin_id,NEW.assigned_admin_id,NEW.escalation_reason);
   IF NEW.assigned_admin_id IS NOT NULL THEN
    INSERT INTO public.bpei_notifications(recipient_id,kind,title,mission_id,incident_id)
    VALUES(NEW.assigned_admin_id,'incident_assigned','Incident affecté à votre suivi',NEW.request_id,NEW.id);
   END IF;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
   INSERT INTO public.bpei_incident_events(
    incident_id,actor_id,event_kind,previous_status,new_status
   ) VALUES(NEW.id,auth.uid(),'status',OLD.status,NEW.status);
  END IF;
 END IF;
 RETURN NEW;
END
$function$
;
REVOKE ALL ON FUNCTION bpei_private.record_incident_escalation_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_log_incident_escalations
 AFTER INSERT OR UPDATE OF priority,assigned_admin_id,status
 ON public.bpei_mission_incidents FOR EACH ROW
 EXECUTE FUNCTION bpei_private.record_incident_escalation_event();
INSERT INTO public.bpei_incident_events(incident_id,actor_id,event_kind,new_priority,new_status,new_assignee,created_at)
 SELECT id,NULL,'created',priority,status,assigned_admin_id,created_at
 FROM public.bpei_mission_incidents;

CREATE OR REPLACE FUNCTION bpei_private.manage_incident_escalation(p_incident_id uuid, p_action text, p_priority text DEFAULT NULL::text, p_assigned_admin_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_admin uuid:=auth.uid(); v_row public.bpei_mission_incidents%ROWTYPE;
 v_reason text:=NULLIF(btrim(p_reason),'');
 v_target timestamptz;
BEGIN
 IF v_admin IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.independent_admins a WHERE a.user_id=v_admin
 ) THEN
  RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_row FROM public.bpei_mission_incidents
 WHERE id=p_incident_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found' USING ERRCODE='P0002'; END IF;
 IF v_row.status='resolved' THEN
  RAISE EXCEPTION 'Resolved incident cannot be reassigned or escalated' USING ERRCODE='22023';
 END IF;
 IF p_action='priority' THEN
  IF p_priority IS NULL OR p_priority NOT IN ('low','normal','high','critical')
     OR p_priority=v_row.priority THEN
   RAISE EXCEPTION 'Invalid or unchanged priority' USING ERRCODE='22023';
  END IF;
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 10 AND 500 THEN
   RAISE EXCEPTION 'Priority change needs a 10-500 character reason' USING ERRCODE='22023';
  END IF;
  v_target:=now()+CASE p_priority
   WHEN 'critical' THEN interval '4 hours'
   WHEN 'high' THEN interval '12 hours'
   WHEN 'normal' THEN interval '48 hours'
   ELSE interval '120 hours' END;
  UPDATE public.bpei_mission_incidents
   SET priority=p_priority,escalation_reason=v_reason,
       target_at=LEAST(target_at,v_target),updated_at=now()
   WHERE id=p_incident_id;
 ELSIF p_action='assign' THEN
  IF p_assigned_admin_id IS NULL OR p_assigned_admin_id=v_row.assigned_admin_id
    OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=p_assigned_admin_id)
  THEN
   RAISE EXCEPTION 'Assignee must be a different authorized administrator' USING ERRCODE='22023';
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) NOT BETWEEN 10 AND 500 THEN
   RAISE EXCEPTION 'Assignment reason must have 10-500 characters' USING ERRCODE='22023';
  END IF;
  UPDATE public.bpei_mission_incidents
   SET assigned_admin_id=p_assigned_admin_id,
       escalation_reason=coalesce(v_reason,escalation_reason),updated_at=now()
   WHERE id=p_incident_id;
 ELSIF p_action='unassign' THEN
  IF v_row.assigned_admin_id IS NULL THEN
   RAISE EXCEPTION 'Incident has no assignee' USING ERRCODE='22023';
  END IF;
  UPDATE public.bpei_mission_incidents
   SET assigned_admin_id=NULL,updated_at=now()
   WHERE id=p_incident_id;
 ELSE
  RAISE EXCEPTION 'Unsupported incident action' USING ERRCODE='22023';
 END IF;
 RETURN (SELECT jsonb_build_object(
   'id',id,'status',status,'priority',priority,
   'assigned_admin_id',assigned_admin_id,'target_at',target_at)
   FROM public.bpei_mission_incidents WHERE id=p_incident_id);
END
$function$
;
REVOKE ALL ON FUNCTION bpei_private.manage_incident_escalation(uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.manage_incident_escalation(uuid,text,text,uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.manage_incident_escalation(p_incident_id uuid, p_action text, p_priority text DEFAULT NULL::text, p_assigned_admin_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
 SELECT bpei_private.manage_incident_escalation(
  p_incident_id,p_action,p_priority,p_assigned_admin_id,p_reason)
$function$
;
REVOKE ALL ON FUNCTION public.manage_incident_escalation(uuid,text,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.manage_incident_escalation(uuid,text,text,uuid,text) TO authenticated;
