-- Candidatures techniciens indépendants (aucun accès accordé automatiquement)
CREATE TABLE public.technician_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 80),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 80),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 6 AND 30),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 120),
  postal_code text NOT NULL CHECK (char_length(postal_code) BETWEEN 4 AND 10),
  business_status text NOT NULL CHECK (business_status IN ('immatricule','en_projet')),
  siret text CHECK (siret IS NULL OR siret ~ '^[0-9]{14}$'),
  legal_form text CHECK (legal_form IS NULL OR char_length(legal_form) <= 80),
  skills text[] NOT NULL DEFAULT '{}',
  skills_other text CHECK (skills_other IS NULL OR char_length(skills_other) <= 500),
  experience_level text CHECK (experience_level IS NULL OR experience_level IN ('moins_1','1_3','3_10','plus_10')),
  intervention_modes text[] NOT NULL DEFAULT '{}',
  service_radius_km integer CHECK (service_radius_km IS NULL OR service_radius_km BETWEEN 0 AND 1000),
  covered_area text CHECK (covered_area IS NULL OR char_length(covered_area) <= 500),
  availability text CHECK (availability IS NULL OR char_length(availability) <= 300),
  has_insurance boolean,
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  acquisition_source text CHECK (acquisition_source IS NULL OR char_length(acquisition_source) <= 60),
  acquisition_detail text CHECK (acquisition_detail IS NULL OR char_length(acquisition_detail) <= 200),
  referral_code text CHECK (referral_code IS NULL OR char_length(referral_code) <= 60),
  utm_source text CHECK (utm_source IS NULL OR char_length(utm_source) <= 100),
  utm_medium text CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 100),
  utm_campaign text CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 100),
  consent boolean NOT NULL DEFAULT false,
  consent_version text,
  status text NOT NULL DEFAULT 'nouvelle' CHECK (status IN ('nouvelle','en_cours','a_verifier','verifiee','refusee','archivee')),
  internal_note text,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.technician_applications IS 'Candidatures de techniciens indépendants (freelance, non salariés). Le statut verifiee ne donne aucun accès automatique aux missions.';

GRANT INSERT ON public.technician_applications TO anon;
GRANT SELECT, INSERT, UPDATE ON public.technician_applications TO authenticated;
GRANT ALL ON public.technician_applications TO service_role;

ALTER TABLE public.technician_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can submit technician application"
ON public.technician_applications FOR INSERT TO anon, authenticated
WITH CHECK (
  consent = true AND status = 'nouvelle' AND internal_note IS NULL
  AND handled_by IS NULL AND handled_at IS NULL
);

CREATE POLICY "platform staff read technician applications"
ON public.technician_applications FOR SELECT TO authenticated
USING (public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role) OR public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role));

CREATE POLICY "platform staff update technician applications"
ON public.technician_applications FOR UPDATE TO authenticated
USING (public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role) OR public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role))
WITH CHECK (public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role) OR public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role));

CREATE INDEX technician_applications_created_idx ON public.technician_applications (created_at DESC);
CREATE INDEX technician_applications_status_idx ON public.technician_applications (status);

CREATE TRIGGER technician_applications_updated_at
BEFORE UPDATE ON public.technician_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Demandes d'intervention clients
CREATE TABLE public.intervention_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  requester_type text NOT NULL DEFAULT 'particulier' CHECK (requester_type IN ('particulier','professionnel')),
  company_name text CHECK (company_name IS NULL OR char_length(company_name) <= 160),
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 80),
  last_name text NOT NULL CHECK (char_length(last_name) BETWEEN 1 AND 80),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 6 AND 30),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 120),
  postal_code text NOT NULL CHECK (char_length(postal_code) BETWEEN 4 AND 10),
  device_type text CHECK (device_type IS NULL OR char_length(device_type) <= 60),
  problem_category text CHECK (problem_category IS NULL OR char_length(problem_category) <= 60),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  preferred_mode text CHECK (preferred_mode IS NULL OR preferred_mode IN ('domicile','a_distance','indifferent')),
  urgency text CHECK (urgency IS NULL OR urgency IN ('rapide','cette_semaine','flexible')),
  availability text CHECK (availability IS NULL OR char_length(availability) <= 300),
  acquisition_source text CHECK (acquisition_source IS NULL OR char_length(acquisition_source) <= 60),
  acquisition_detail text CHECK (acquisition_detail IS NULL OR char_length(acquisition_detail) <= 200),
  referral_code text CHECK (referral_code IS NULL OR char_length(referral_code) <= 60),
  utm_source text CHECK (utm_source IS NULL OR char_length(utm_source) <= 100),
  utm_medium text CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 100),
  utm_campaign text CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 100),
  consent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'nouvelle' CHECK (status IN ('nouvelle','en_cours','en_attente','orientee','sans_suite','cloturee','archivee')),
  internal_note text,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.intervention_requests IS 'Demandes d''intervention informatique déposées par des clients. Aucune prise en charge garantie.';

GRANT INSERT ON public.intervention_requests TO anon;
GRANT SELECT, INSERT, UPDATE ON public.intervention_requests TO authenticated;
GRANT ALL ON public.intervention_requests TO service_role;

ALTER TABLE public.intervention_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can submit intervention request"
ON public.intervention_requests FOR INSERT TO anon, authenticated
WITH CHECK (
  consent = true AND status = 'nouvelle' AND internal_note IS NULL
  AND handled_by IS NULL AND handled_at IS NULL
);

CREATE POLICY "platform staff read intervention requests"
ON public.intervention_requests FOR SELECT TO authenticated
USING (public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role) OR public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role));

CREATE POLICY "platform staff update intervention requests"
ON public.intervention_requests FOR UPDATE TO authenticated
USING (public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role) OR public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role))
WITH CHECK (public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role) OR public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role));

CREATE INDEX intervention_requests_created_idx ON public.intervention_requests (created_at DESC);
CREATE INDEX intervention_requests_status_idx ON public.intervention_requests (status);

CREATE TRIGGER intervention_requests_updated_at
BEFORE UPDATE ON public.intervention_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();