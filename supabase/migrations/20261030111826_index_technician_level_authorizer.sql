-- Cover the technician authorization reviewer FK for efficient checks/deletes.
-- Additive performance fix; does not alter roles or launch controls.
CREATE INDEX IF NOT EXISTS bpei_technician_levels_authorized_by_idx
  ON public.bpei_technician_levels (authorized_by);
