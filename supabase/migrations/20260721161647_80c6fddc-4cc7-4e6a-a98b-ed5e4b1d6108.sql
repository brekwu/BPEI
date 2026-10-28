-- 1. Pilot flag on shops (default OFF)
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS ai_import_pilot_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_import_pilot_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_import_pilot_granted_by uuid REFERENCES auth.users(id);

-- 2. Technical metrics on import_jobs
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS metric_file_format text,
  ADD COLUMN IF NOT EXISTS metric_file_bytes bigint,
  ADD COLUMN IF NOT EXISTS metric_rows_total integer,
  ADD COLUMN IF NOT EXISTS metric_rows_recognized integer,
  ADD COLUMN IF NOT EXISTS metric_rows_manual_fixes integer,
  ADD COLUMN IF NOT EXISTS metric_rows_errors integer,
  ADD COLUMN IF NOT EXISTS metric_rows_duplicates integer,
  ADD COLUMN IF NOT EXISTS metric_parse_ms integer,
  ADD COLUMN IF NOT EXISTS metric_ai_ms integer,
  ADD COLUMN IF NOT EXISTS metric_generation_ms integer,
  ADD COLUMN IF NOT EXISTS metric_ai_cost_cents integer,
  ADD COLUMN IF NOT EXISTS metric_final_outcome text
    CHECK (metric_final_outcome IS NULL OR metric_final_outcome IN ('success','partial','failed','cancelled','suspended'));

-- 3. Helper: is a given shop admitted to the pilot beta?
CREATE OR REPLACE FUNCTION public.is_ai_import_pilot(_shop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.is_ai_import_enabled(), false)
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = _shop_id AND s.ai_import_pilot_access = true
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_ai_import_pilot(uuid) TO authenticated, service_role;

-- 4. Tighten insert policies to require pilot access
DROP POLICY IF EXISTS import_jobs_shop_insert ON public.import_jobs;
CREATE POLICY import_jobs_shop_insert ON public.import_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_shop(auth.uid(), shop_id)
    AND created_by = auth.uid()
    AND public.is_ai_import_pilot(shop_id)
  );

DROP POLICY IF EXISTS import_files_shop_insert ON public.import_files;
CREATE POLICY import_files_shop_insert ON public.import_files
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.import_jobs j
      WHERE j.id = job_id
        AND public.can_manage_shop(auth.uid(), j.shop_id)
        AND public.is_ai_import_pilot(j.shop_id)
    )
  );

-- 5. RPC to add/remove a pilot shop (owner_bpei only)
CREATE OR REPLACE FUNCTION public.set_ai_import_pilot_access(_shop_id uuid, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_owner_bpei(v_uid) THEN
    RAISE EXCEPTION 'Seul un owner_bpei peut modifier la liste blanche pilote';
  END IF;
  UPDATE public.shops
    SET ai_import_pilot_access = _enabled,
        ai_import_pilot_granted_at = CASE WHEN _enabled THEN now() ELSE NULL END,
        ai_import_pilot_granted_by = CASE WHEN _enabled THEN v_uid ELSE NULL END
    WHERE id = _shop_id;
  RETURN _enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.set_ai_import_pilot_access(uuid, boolean) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.set_ai_import_pilot_access(uuid, boolean) TO authenticated;

-- 6. RPC to suspend an import (owner_bpei only)
CREATE OR REPLACE FUNCTION public.suspend_import_job(_job_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_owner_bpei(v_uid) THEN
    RAISE EXCEPTION 'Seul un owner_bpei peut suspendre un import';
  END IF;
  UPDATE public.import_jobs
    SET status = 'cancelled',
        metric_final_outcome = 'suspended',
        error = COALESCE(_reason, 'Suspendu par BPEI'),
        completed_at = now(),
        generation_lock_token = NULL
    WHERE id = _job_id;
  INSERT INTO public.import_audit_logs (job_id, action, actor_user_id, payload)
    VALUES (_job_id, 'job.suspended_by_bpei', v_uid, jsonb_build_object('reason', _reason));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.suspend_import_job(uuid, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_import_job(uuid, text) TO authenticated;

-- 7. Feedback table
CREATE TABLE IF NOT EXISTS public.import_beta_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id),
  rating_ease smallint CHECK (rating_ease BETWEEN 1 AND 5),
  rating_recognition smallint CHECK (rating_recognition BETWEEN 1 AND 5),
  time_saved_minutes integer CHECK (time_saved_minutes >= 0 AND time_saved_minutes <= 100000),
  poorly_recognized text,
  missing_feature text,
  comment text,
  allow_contact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, submitted_by)
);
GRANT SELECT, INSERT ON public.import_beta_feedback TO authenticated;
GRANT ALL ON public.import_beta_feedback TO service_role;
ALTER TABLE public.import_beta_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY import_beta_feedback_shop_insert ON public.import_beta_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_shop_member(auth.uid(), shop_id)
    AND submitted_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.import_jobs j WHERE j.id = job_id AND j.shop_id = import_beta_feedback.shop_id)
  );

CREATE POLICY import_beta_feedback_read ON public.import_beta_feedback
  FOR SELECT TO authenticated
  USING (
    public.is_shop_member(auth.uid(), shop_id)
    OR public.is_owner_bpei(auth.uid())
  );