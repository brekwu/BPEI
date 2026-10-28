CREATE TYPE public.import_job_status AS ENUM (
  'draft','uploading','queued','analyzing','review','importing','completed','failed','cancelled','rolled_back'
);
CREATE TYPE public.import_job_kind AS ENUM (
  'products','stock','services','customers','shop_profile','mixed'
);
CREATE TYPE public.import_file_kind AS ENUM (
  'csv','xlsx','pdf','image','json','other'
);
CREATE TYPE public.import_row_status AS ENUM (
  'pending','ready','needs_review','rejected','imported','error'
);

INSERT INTO public.app_settings (key, value)
VALUES ('ai_import_enabled', to_jsonb(false))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_ai_import_enabled()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::boolean FROM public.app_settings WHERE key = 'ai_import_enabled'),
    false
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_ai_import_enabled() TO authenticated, anon;

CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  kind public.import_job_kind NOT NULL DEFAULT 'mixed',
  status public.import_job_status NOT NULL DEFAULT 'draft',
  title text,
  notes text,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_summary jsonb,
  error text,
  bpei_assisted boolean NOT NULL DEFAULT false,
  bpei_authorized_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  bpei_authorized_at timestamptz,
  rollback_available_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX idx_import_jobs_shop ON public.import_jobs(shop_id, created_at DESC);
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO authenticated;
GRANT ALL ON public.import_jobs TO service_role;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_jobs_shop_read" ON public.import_jobs FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "import_jobs_shop_insert" ON public.import_jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_shop(auth.uid(), shop_id)
    AND created_by = auth.uid()
    AND public.is_ai_import_enabled()
  );
CREATE POLICY "import_jobs_shop_update" ON public.import_jobs FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "import_jobs_shop_delete" ON public.import_jobs FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));

CREATE TABLE public.import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  storage_path text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 52428800),
  kind public.import_file_kind NOT NULL DEFAULT 'other',
  sha256 text,
  scan_status text NOT NULL DEFAULT 'pending',
  parsed_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_files_job ON public.import_files(job_id);
CREATE INDEX idx_import_files_shop ON public.import_files(shop_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_files TO authenticated;
GRANT ALL ON public.import_files TO service_role;
ALTER TABLE public.import_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_files_shop_read" ON public.import_files FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "import_files_shop_insert" ON public.import_files FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_shop(auth.uid(), shop_id)
    AND uploaded_by = auth.uid()
    AND public.is_ai_import_enabled()
    AND EXISTS (SELECT 1 FROM public.import_jobs j WHERE j.id = job_id AND j.shop_id = import_files.shop_id)
  );
CREATE POLICY "import_files_shop_delete" ON public.import_files FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));

CREATE TABLE public.import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  file_id uuid REFERENCES public.import_files(id) ON DELETE SET NULL,
  entity_kind text NOT NULL,
  source_index integer,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested jsonb,
  status public.import_row_status NOT NULL DEFAULT 'pending',
  duplicate_of uuid,
  target_table text,
  target_id uuid,
  errors jsonb,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_rows_job ON public.import_rows(job_id, status);
CREATE INDEX idx_import_rows_shop ON public.import_rows(shop_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rows TO authenticated;
GRANT ALL ON public.import_rows TO service_role;
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_rows_shop_read" ON public.import_rows FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "import_rows_shop_write" ON public.import_rows FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));

CREATE TABLE public.import_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL DEFAULT 'shop',
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_audit_shop ON public.import_audit_logs(shop_id, created_at DESC);
CREATE INDEX idx_import_audit_job ON public.import_audit_logs(job_id);

GRANT SELECT, INSERT ON public.import_audit_logs TO authenticated;
GRANT ALL ON public.import_audit_logs TO service_role;
ALTER TABLE public.import_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_audit_shop_read" ON public.import_audit_logs FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "import_audit_shop_insert" ON public.import_audit_logs FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()))
    AND (actor_user_id = auth.uid() OR actor_user_id IS NULL)
  );

CREATE TABLE public.import_site_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_notes text,
  status text NOT NULL DEFAULT 'draft',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_site_drafts_shop ON public.import_site_drafts(shop_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_site_drafts TO authenticated;
GRANT ALL ON public.import_site_drafts TO service_role;
ALTER TABLE public.import_site_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_site_drafts_shop_read" ON public.import_site_drafts FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "import_site_drafts_shop_write" ON public.import_site_drafts FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));

CREATE TRIGGER trg_import_jobs_updated_at BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_import_site_drafts_updated_at BEFORE UPDATE ON public.import_site_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "imports_sources_shop_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'imports-sources'
    AND (
      public.is_admin_bpei(auth.uid())
      OR public.is_shop_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );
CREATE POLICY "imports_sources_shop_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'imports-sources'
    AND public.can_manage_shop(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND public.is_ai_import_enabled()
  );
CREATE POLICY "imports_sources_shop_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'imports-sources'
    AND (
      public.is_admin_bpei(auth.uid())
      OR public.can_manage_shop(auth.uid(), ((storage.foldername(name))[1])::uuid)
    )
  );