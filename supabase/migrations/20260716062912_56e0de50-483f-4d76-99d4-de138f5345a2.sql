CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  subject_kind TEXT NOT NULL CHECK (subject_kind IN ('particulier','boutique','rejoindre','support','commercial','reclamation','autre')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  shop_name TEXT,
  city TEXT,
  origin_path TEXT,
  message TEXT NOT NULL,
  consent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'nouvelle' CHECK (status IN ('nouvelle','en_cours','en_attente','resolue','archivee')),
  internal_note TEXT,
  ip TEXT,
  user_agent TEXT,
  handled_by UUID,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_submissions_status ON public.contact_submissions(status, created_at DESC);
GRANT INSERT ON public.contact_submissions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can submit contact" ON public.contact_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated can submit contact" ON public.contact_submissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_bpei read contact" ON public.contact_submissions FOR SELECT TO authenticated USING (public.has_platform_role(auth.uid(), 'admin_bpei'));
CREATE POLICY "admin_bpei update contact" ON public.contact_submissions FOR UPDATE TO authenticated USING (public.has_platform_role(auth.uid(), 'admin_bpei')) WITH CHECK (public.has_platform_role(auth.uid(), 'admin_bpei'));

CREATE TABLE public.demo_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  city TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  establishments_count INT,
  preferred_slot TEXT,
  message TEXT,
  consent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'nouvelle' CHECK (status IN ('nouvelle','contactee','demo_prevue','acceptee','refusee','archivee')),
  internal_note TEXT,
  ip TEXT,
  user_agent TEXT,
  handled_by UUID,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_demo_requests_status ON public.demo_requests(status, created_at DESC);
GRANT INSERT ON public.demo_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.demo_requests TO authenticated;
GRANT ALL ON public.demo_requests TO service_role;
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public can submit demo" ON public.demo_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "authenticated can submit demo" ON public.demo_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_bpei read demo" ON public.demo_requests FOR SELECT TO authenticated USING (public.has_platform_role(auth.uid(), 'admin_bpei'));
CREATE POLICY "admin_bpei update demo" ON public.demo_requests FOR UPDATE TO authenticated USING (public.has_platform_role(auth.uid(), 'admin_bpei')) WITH CHECK (public.has_platform_role(auth.uid(), 'admin_bpei'));

CREATE TRIGGER contact_submissions_touch BEFORE UPDATE ON public.contact_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER demo_requests_touch BEFORE UPDATE ON public.demo_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();