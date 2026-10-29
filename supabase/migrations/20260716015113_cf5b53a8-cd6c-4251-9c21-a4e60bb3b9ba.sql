-- Server-side slot validation for admin drag/drop and manual updates
CREATE OR REPLACE FUNCTION public.check_appointment_slot(
  _shop_id uuid,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _technician_user_id uuid DEFAULT NULL,
  _exclude_appointment_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day int;
  _hours record;
  _local_start time;
  _local_end time;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _shop_id) THEN
    RAISE EXCEPTION 'access_denied';
  END IF;
  IF _ends_at <= _starts_at THEN RAISE EXCEPTION 'invalid_range'; END IF;

  IF EXISTS (SELECT 1 FROM public.shop_closures c
             WHERE c.shop_id = _shop_id AND c.starts_at < _ends_at AND c.ends_at > _starts_at) THEN
    RAISE EXCEPTION 'shop_closed';
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointment_blocked_slots b
             WHERE b.shop_id = _shop_id
               AND (b.technician_user_id IS NULL OR b.technician_user_id = _technician_user_id)
               AND b.starts_at < _ends_at AND b.ends_at > _starts_at) THEN
    RAISE EXCEPTION 'slot_blocked';
  END IF;

  IF _starts_at::date = _ends_at::date THEN
    _day := extract(dow from _starts_at)::int;
    SELECT opens_at, closes_at, is_closed, break_start, break_end INTO _hours
      FROM public.shop_business_hours WHERE shop_id = _shop_id AND day_of_week = _day;
    IF _hours IS NOT NULL THEN
      IF _hours.is_closed THEN RAISE EXCEPTION 'shop_closed_today'; END IF;
      IF _hours.opens_at IS NOT NULL AND _hours.closes_at IS NOT NULL THEN
        _local_start := _starts_at::time; _local_end := _ends_at::time;
        IF _local_start < _hours.opens_at OR _local_end > _hours.closes_at THEN
          RAISE EXCEPTION 'outside_business_hours';
        END IF;
        IF _hours.break_start IS NOT NULL AND _hours.break_end IS NOT NULL
           AND _local_start < _hours.break_end AND _local_end > _hours.break_start THEN
          RAISE EXCEPTION 'during_break';
        END IF;
      END IF;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointments a
             WHERE a.shop_id = _shop_id
               AND a.status NOT IN ('cancelled','no_show')
               AND (_exclude_appointment_id IS NULL OR a.id <> _exclude_appointment_id)
               AND a.starts_at < _ends_at AND a.ends_at > _starts_at
               AND (
                 _technician_user_id IS NULL
                 OR a.technician_user_id IS NULL
                 OR a.technician_user_id = _technician_user_id
               )) THEN
    RAISE EXCEPTION 'slot_collision';
  END IF;

  IF _technician_user_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.technician_time_off t
               WHERE t.shop_id = _shop_id AND t.user_id = _technician_user_id
                 AND t.status = 'approved'
                 AND t.starts_at < _ends_at AND t.ends_at > _starts_at) THEN
      RAISE EXCEPTION 'technician_off';
    END IF;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.check_appointment_slot(uuid, timestamptz, timestamptz, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_appointment_slot(uuid, timestamptz, timestamptz, uuid, uuid) TO authenticated;

-- Convert a confirmed appointment into a repair (idempotent per appointment)
CREATE OR REPLACE FUNCTION public.convert_appointment_to_repair(
  _appointment_id uuid,
  _customer_id uuid,
  _device_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _appt public.appointments%ROWTYPE;
  _repair_id uuid;
BEGIN
  SELECT * INTO _appt FROM public.appointments WHERE id = _appointment_id FOR UPDATE;
  IF _appt.id IS NULL THEN RAISE EXCEPTION 'appointment_not_found'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _appt.shop_id) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF _appt.repair_id IS NOT NULL THEN RAISE EXCEPTION 'already_converted'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = _customer_id AND shop_id = _appt.shop_id) THEN
    RAISE EXCEPTION 'customer_not_in_shop';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.devices WHERE id = _device_id AND shop_id = _appt.shop_id) THEN
    RAISE EXCEPTION 'device_not_in_shop';
  END IF;

  INSERT INTO public.repairs(shop_id, customer_id, device_id, status, priority,
    assigned_technician_id, intake_channel, customer_issue, initial_condition, created_by)
  VALUES (_appt.shop_id, _customer_id, _device_id,
    'awaiting_diagnosis'::public.repair_status,
    CASE WHEN _appt.is_urgent THEN 'urgent'::public.repair_priority ELSE 'normal'::public.repair_priority END,
    _appt.technician_user_id, 'appointment',
    COALESCE(_appt.problem_description, _appt.device_description),
    _appt.device_description, auth.uid())
  RETURNING id INTO _repair_id;

  UPDATE public.appointments SET
    repair_id = _repair_id,
    customer_id = COALESCE(customer_id, _customer_id),
    status = CASE WHEN status IN ('pending','confirmed') THEN 'completed'::public.appointment_status ELSE status END
  WHERE id = _appointment_id;

  RETURN _repair_id;
END; $$;

REVOKE ALL ON FUNCTION public.convert_appointment_to_repair(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.convert_appointment_to_repair(uuid, uuid, uuid) TO authenticated;

-- Helper: list shop technicians (members with technician-capable roles)
CREATE OR REPLACE FUNCTION public.list_shop_technicians(_shop_id uuid)
RETURNS TABLE(user_id uuid, role public.shop_role, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, m.role, p.first_name, p.last_name
  FROM public.shop_memberships m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.shop_id = _shop_id
    AND public.is_shop_member(auth.uid(), _shop_id)
  ORDER BY p.last_name NULLS LAST, p.first_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.list_shop_technicians(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_shop_technicians(uuid) TO authenticated;