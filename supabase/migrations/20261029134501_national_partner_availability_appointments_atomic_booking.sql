-- BPEI partner availability and confirmed appointments; no public self-booking without operator verification.
CREATE TABLE public.bpei_partner_availability_slots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 partner_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE CASCADE,
 start_at timestamptz NOT NULL,
 end_at timestamptz NOT NULL,
 mode text NOT NULL CHECK(mode IN ('on_site','remote')),
 status text NOT NULL DEFAULT 'available'
  CHECK(status IN ('available','reserved','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_at>start_at AND end_at<=start_at+interval '8 hours')
);
CREATE INDEX bpei_availability_partner_time ON public.bpei_partner_availability_slots(partner_id,start_at);
ALTER TABLE public.bpei_partner_availability_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_partner_availability_slots FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.bpei_partner_availability_slots TO authenticated;
CREATE POLICY bpei_availability_private_read ON public.bpei_partner_availability_slots
 FOR SELECT TO authenticated USING(partner_id=(SELECT auth.uid()) OR EXISTS(
  SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
 ));
CREATE POLICY bpei_availability_owner_insert ON public.bpei_partner_availability_slots
 FOR INSERT TO authenticated WITH CHECK(
  partner_id=(SELECT auth.uid()) AND status='available'
  AND start_at>now()+interval '10 minutes'
  AND end_at<=now()+interval '180 days'
 );
CREATE FUNCTION bpei_private.reject_overlapping_availability()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.partner_id<>OLD.partner_id OR NEW.start_at<>OLD.start_at OR NEW.end_at<>OLD.end_at OR NEW.mode<>OLD.mode)
 THEN RAISE EXCEPTION 'Availability slot immutable' USING ERRCODE='42501'; END IF;
 IF TG_OP='INSERT' THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.partner_id::text,31));
  IF EXISTS(SELECT 1 FROM public.bpei_partner_availability_slots s
   WHERE s.partner_id=NEW.partner_id AND s.status<>'cancelled'
    AND pg_catalog.tstzrange(s.start_at,s.end_at,'[)') && pg_catalog.tstzrange(NEW.start_at,NEW.end_at,'[)')
  ) THEN RAISE EXCEPTION 'Availability overlaps an existing slot' USING ERRCODE='23505'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bpei_private.reject_overlapping_availability() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_no_availability_overlap BEFORE INSERT OR UPDATE ON public.bpei_partner_availability_slots
 FOR EACH ROW EXECUTE FUNCTION bpei_private.reject_overlapping_availability();

CREATE TABLE public.bpei_partner_appointments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES public.independent_requests(id) ON DELETE RESTRICT,
 slot_id uuid NOT NULL REFERENCES public.bpei_partner_availability_slots(id) ON DELETE RESTRICT,
 partner_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','completed')),
 confirmed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 confirmed_at timestamptz NOT NULL DEFAULT now(),
 cancelled_at timestamptz,
 cancellation_reason text,
 UNIQUE(request_id,slot_id),
 CHECK((status='cancelled' AND cancelled_at IS NOT NULL AND char_length(btrim(cancellation_reason)) BETWEEN 20 AND 500)
  OR (status<>'cancelled' AND cancelled_at IS NULL AND cancellation_reason IS NULL))
);
CREATE UNIQUE INDEX bpei_unique_active_appointment_per_mission
 ON public.bpei_partner_appointments(request_id) WHERE status='confirmed';
CREATE UNIQUE INDEX bpei_unique_active_appointment_per_slot
 ON public.bpei_partner_appointments(slot_id) WHERE status='confirmed';
CREATE INDEX bpei_appointments_partner_idx ON public.bpei_partner_appointments(partner_id);
CREATE INDEX bpei_appointments_admin_idx ON public.bpei_partner_appointments(confirmed_by);
ALTER TABLE public.bpei_partner_appointments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_partner_appointments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_partner_appointments TO authenticated;
CREATE POLICY bpei_appointments_private_read ON public.bpei_partner_appointments
 FOR SELECT TO authenticated USING(partner_id=(SELECT auth.uid()) OR EXISTS(
  SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
 ));
CREATE FUNCTION bpei_private.confirm_partner_appointment(p_request_id uuid,p_slot_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());v_request public.independent_requests%ROWTYPE;
 v_slot public.bpei_partner_availability_slots%ROWTYPE;v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=v_actor)
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_request FROM public.independent_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_request.status<>'accepted' OR v_request.inquiry_id IS NULL
 THEN RAISE EXCEPTION 'Accepted intervention required' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_slot FROM public.bpei_partner_availability_slots WHERE id=p_slot_id FOR UPDATE;
 IF NOT FOUND OR v_slot.partner_id<>v_request.independent_id OR v_slot.status<>'available'
  OR v_slot.start_at<=now()+interval '10 minutes'
 THEN RAISE EXCEPTION 'Matching future available slot required' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bpei_technician_levels
  WHERE user_id=v_request.independent_id AND authorization_state='active')
 THEN RAISE EXCEPTION 'Partner authorization expired' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_partner_appointments a
  WHERE a.request_id=p_request_id AND a.status='confirmed')
 THEN RAISE EXCEPTION 'Mission already has an appointment' USING ERRCODE='23505'; END IF;
 INSERT INTO public.bpei_partner_appointments(request_id,slot_id,partner_id,confirmed_by)
 VALUES(p_request_id,p_slot_id,v_slot.partner_id,v_actor)
 RETURNING id INTO v_id;
 UPDATE public.bpei_partner_availability_slots SET status='reserved' WHERE id=p_slot_id;
 UPDATE public.independent_requests SET scheduled_at=v_slot.start_at,updated_at=now()
 WHERE id=p_request_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION bpei_private.confirm_partner_appointment(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.confirm_partner_appointment(uuid,uuid) TO authenticated;
CREATE FUNCTION public.confirm_partner_appointment(p_request_id uuid,p_slot_id uuid)
 RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.confirm_partner_appointment($1,$2)
$$;
REVOKE ALL ON FUNCTION public.confirm_partner_appointment(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_partner_appointment(uuid,uuid) TO authenticated;

CREATE FUNCTION bpei_private.cancel_partner_appointment(p_appointment_id uuid,p_reason text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());v_appointment public.bpei_partner_appointments%ROWTYPE;
 v_slot public.bpei_partner_availability_slots%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 500
 THEN RAISE EXCEPTION 'Documented cancellation reason required' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_appointment FROM public.bpei_partner_appointments
 WHERE id=p_appointment_id FOR UPDATE;
 IF NOT FOUND OR v_appointment.status<>'confirmed'
 OR (v_actor<>v_appointment.partner_id AND NOT EXISTS(
  SELECT 1 FROM public.independent_admins WHERE user_id=v_actor))
 THEN RAISE EXCEPTION 'Appointment unavailable or unauthorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_slot FROM public.bpei_partner_availability_slots
 WHERE id=v_appointment.slot_id FOR UPDATE;
 IF v_slot.start_at<=now() THEN
  RAISE EXCEPTION 'Past appointment requires manual incident review' USING ERRCODE='22023'; END IF;
 UPDATE public.bpei_partner_appointments
 SET status='cancelled',cancelled_at=now(),cancellation_reason=btrim(p_reason)
 WHERE id=p_appointment_id;
 -- Restore slot to bookable only if still safely in the future.
 UPDATE public.bpei_partner_availability_slots
 SET status=CASE WHEN start_at>now()+interval '10 minutes' THEN 'available' ELSE 'cancelled' END
 WHERE id=v_slot.id;
 UPDATE public.independent_requests SET scheduled_at=NULL,updated_at=now()
 WHERE id=v_appointment.request_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.cancel_partner_appointment(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.cancel_partner_appointment(uuid,text) TO authenticated;
CREATE FUNCTION public.cancel_partner_appointment(p_appointment_id uuid,p_reason text)
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.cancel_partner_appointment($1,$2)
$$;
REVOKE ALL ON FUNCTION public.cancel_partner_appointment(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_partner_appointment(uuid,text) TO authenticated;

CREATE FUNCTION bpei_private.cancel_own_availability(p_slot_id uuid) RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());
BEGIN
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 UPDATE public.bpei_partner_availability_slots SET status='cancelled'
 WHERE id=p_slot_id AND partner_id=v_actor AND status='available' AND start_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Available future owned slot required' USING ERRCODE='42501'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.cancel_own_availability(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.cancel_own_availability(uuid) TO authenticated;
CREATE FUNCTION public.cancel_own_availability(p_slot_id uuid) RETURNS boolean
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.cancel_own_availability($1)
$$;
REVOKE ALL ON FUNCTION public.cancel_own_availability(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_own_availability(uuid) TO authenticated;
