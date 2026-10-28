-- Applied in BPEI Supabase preproduction as migration 20261028172750.
-- Append-only mission state transitions, visible only to the assigned
-- technician and authorized administrators.
CREATE TABLE public.bpei_mission_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES public.independent_requests(id) ON DELETE RESTRICT,
 independent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 previous_status text,
 new_status text NOT NULL CHECK(new_status IN ('new','accepted','in_progress','completed','cancelled')),
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT bpei_mission_event_change CHECK(
  previous_status IS NULL OR previous_status IS DISTINCT FROM new_status
 )
);
CREATE INDEX bpei_mission_events_by_request ON public.bpei_mission_events(request_id,occurred_at,id);
CREATE INDEX bpei_mission_events_by_independent ON public.bpei_mission_events(independent_id,occurred_at DESC);
ALTER TABLE public.bpei_mission_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_mission_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_mission_events TO authenticated;
CREATE POLICY bpei_mission_event_read_owner_admin ON public.bpei_mission_events
 FOR SELECT TO authenticated USING (
  independent_id=(SELECT auth.uid())
  OR EXISTS(
   SELECT 1 FROM public.independent_admins adm WHERE adm.user_id=(SELECT auth.uid())
  )
 );

CREATE OR REPLACE FUNCTION bpei_private.record_bpei_mission_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.bpei_mission_events(
   request_id,independent_id,previous_status,new_status,actor_id
  ) VALUES(NEW.id,NEW.independent_id,NULL,NEW.status,auth.uid());
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO public.bpei_mission_events(
   request_id,independent_id,previous_status,new_status,actor_id
  ) VALUES(NEW.id,NEW.independent_id,OLD.status,NEW.status,auth.uid());
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bpei_private.record_bpei_mission_event()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_track_mission_event
 AFTER INSERT OR UPDATE OF status ON public.independent_requests
 FOR EACH ROW EXECUTE FUNCTION bpei_private.record_bpei_mission_event();

-- Historical baseline only; do not fabricate prior transitions.
INSERT INTO public.bpei_mission_events(request_id,independent_id,previous_status,new_status,actor_id,occurred_at)
SELECT id,independent_id,NULL,status,NULL,created_at FROM public.independent_requests;
