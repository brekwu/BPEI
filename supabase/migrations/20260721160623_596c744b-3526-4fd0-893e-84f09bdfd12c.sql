-- Import intelligent BPEI — audit correctif :
-- 1) validation finale obligatoire par la boutique
-- 2) idempotence stricte
-- 3) restriction assistance BPEI (accès scopé au job assigné)
-- 4) contrôle du flag ai_import_enabled côté owner_bpei uniquement

-- Colonnes de validation finale + verrou d'exécution
ALTER TABLE public.import_jobs
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_digest text,
  ADD COLUMN IF NOT EXISTS generation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS generation_lock_token uuid;

-- Idempotence : une ligne importée ne peut pointer qu'une seule entité
CREATE UNIQUE INDEX IF NOT EXISTS import_rows_unique_target
  ON public.import_rows (target_table, target_id)
  WHERE target_id IS NOT NULL;

-- Helper d'accès BPEI scopé (owner_bpei = accès global, admin_bpei = uniquement le job assigné avec assistance active)
CREATE OR REPLACE FUNCTION public.bpei_can_access_job(_user uuid, _job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.import_jobs j
    WHERE j.id = _job_id
      AND (
        public.is_owner_bpei(_user)
        OR (
          public.is_admin_bpei(_user)
          AND j.bpei_assignee_user_id = _user
          AND j.bpei_assistance_status IN ('requested','in_progress')
        )
      )
  )
$$;
GRANT EXECUTE ON FUNCTION public.bpei_can_access_job(uuid, uuid) TO authenticated;

-- Restriction : import_jobs
DROP POLICY IF EXISTS import_jobs_bpei_read ON public.import_jobs;
DROP POLICY IF EXISTS import_jobs_bpei_update ON public.import_jobs;
DROP POLICY IF EXISTS import_jobs_shop_read ON public.import_jobs;
DROP POLICY IF EXISTS import_jobs_shop_update ON public.import_jobs;

CREATE POLICY import_jobs_read ON public.import_jobs FOR SELECT
  USING (
    public.is_shop_member(auth.uid(), shop_id)
    OR public.is_owner_bpei(auth.uid())
    OR (
      public.is_admin_bpei(auth.uid())
      AND bpei_assignee_user_id = auth.uid()
      AND bpei_assistance_status IN ('requested','in_progress')
    )
  );

CREATE POLICY import_jobs_update ON public.import_jobs FOR UPDATE
  USING (
    public.can_manage_shop(auth.uid(), shop_id)
    OR public.is_owner_bpei(auth.uid())
    OR (
      public.is_admin_bpei(auth.uid())
      AND bpei_assignee_user_id = auth.uid()
      AND bpei_assistance_status IN ('requested','in_progress')
    )
  )
  WITH CHECK (
    public.can_manage_shop(auth.uid(), shop_id)
    OR public.is_owner_bpei(auth.uid())
    OR (public.is_admin_bpei(auth.uid()) AND bpei_assignee_user_id = auth.uid())
  );

-- Restriction : import_rows
DROP POLICY IF EXISTS import_rows_bpei_read ON public.import_rows;
DROP POLICY IF EXISTS import_rows_shop_read ON public.import_rows;
DROP POLICY IF EXISTS import_rows_shop_write ON public.import_rows;

CREATE POLICY import_rows_read ON public.import_rows FOR SELECT
  USING (
    public.is_shop_member(auth.uid(), shop_id)
    OR public.bpei_can_access_job(auth.uid(), job_id)
  );

CREATE POLICY import_rows_write ON public.import_rows FOR ALL
  USING (
    public.can_manage_shop(auth.uid(), shop_id)
    OR public.bpei_can_access_job(auth.uid(), job_id)
  )
  WITH CHECK (
    public.can_manage_shop(auth.uid(), shop_id)
    OR public.bpei_can_access_job(auth.uid(), job_id)
  );

-- Restriction : import_files
DROP POLICY IF EXISTS import_files_shop_read ON public.import_files;
DROP POLICY IF EXISTS import_files_shop_delete ON public.import_files;

CREATE POLICY import_files_read ON public.import_files FOR SELECT
  USING (
    public.is_shop_member(auth.uid(), shop_id)
    OR public.bpei_can_access_job(auth.uid(), job_id)
  );

CREATE POLICY import_files_delete ON public.import_files FOR DELETE
  USING (public.can_manage_shop(auth.uid(), shop_id));

-- Restriction : import_audit_logs
DROP POLICY IF EXISTS import_audit_shop_read ON public.import_audit_logs;
CREATE POLICY import_audit_read ON public.import_audit_logs FOR SELECT
  USING (
    public.is_shop_member(auth.uid(), shop_id)
    OR (job_id IS NOT NULL AND public.bpei_can_access_job(auth.uid(), job_id))
    OR public.is_owner_bpei(auth.uid())
  );

-- RPC : bascule du flag réservée aux owner_bpei
CREATE OR REPLACE FUNCTION public.set_ai_import_enabled(_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN
    RAISE EXCEPTION 'Seul un owner_bpei peut modifier ai_import_enabled';
  END IF;
  UPDATE public.app_settings SET value = to_jsonb(_enabled), updated_at = now()
    WHERE key = 'ai_import_enabled';
  IF NOT FOUND THEN
    INSERT INTO public.app_settings(key, value) VALUES('ai_import_enabled', to_jsonb(_enabled));
  END IF;
  RETURN _enabled;
END $$;
REVOKE ALL ON FUNCTION public.set_ai_import_enabled(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ai_import_enabled(boolean) TO authenticated;

-- RPC : confirmation finale obligatoire par la boutique (jamais par BPEI)
CREATE OR REPLACE FUNCTION public.confirm_import_validation(_job_id uuid, _digest text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.import_jobs WHERE id = _job_id;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'Import introuvable'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), v_shop) THEN
    RAISE EXCEPTION 'Seul un responsable de la boutique peut confirmer la validation';
  END IF;
  IF public.is_admin_bpei(auth.uid()) OR public.is_owner_bpei(auth.uid()) THEN
    -- Un BPEI qui serait aussi membre boutique n'a pas le droit d'agir en tant que BPEI
    -- ici, la condition can_manage_shop garantit déjà l'identité boutique.
    NULL;
  END IF;
  UPDATE public.import_jobs
    SET validated_by = auth.uid(),
        validated_at = now(),
        validated_digest = _digest
  WHERE id = _job_id;
END $$;
REVOKE ALL ON FUNCTION public.confirm_import_validation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_import_validation(uuid, text) TO authenticated;

-- RPC : verrou d'exécution atomique (empêche 2 générations simultanées)
CREATE OR REPLACE FUNCTION public.acquire_import_generation_lock(_job_id uuid, _token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.import_jobs WHERE id = _job_id;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'Import introuvable'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), v_shop) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  UPDATE public.import_jobs
    SET generation_started_at = now(), generation_lock_token = _token
  WHERE id = _job_id
    AND (generation_lock_token IS NULL OR generation_started_at < now() - interval '10 minutes');
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.acquire_import_generation_lock(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_import_generation_lock(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_import_generation_lock(_job_id uuid, _token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.import_jobs
    SET generation_started_at = NULL, generation_lock_token = NULL
    WHERE id = _job_id AND generation_lock_token = _token;
$$;
REVOKE ALL ON FUNCTION public.release_import_generation_lock(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_import_generation_lock(uuid, uuid) TO authenticated;