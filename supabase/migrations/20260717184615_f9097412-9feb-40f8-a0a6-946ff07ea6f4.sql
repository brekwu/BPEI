-- === Lot juridique : tables ===

CREATE TABLE IF NOT EXISTS public.platform_legal_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  legal_name text, commercial_name text, legal_form text,
  capital_amount text, registered_office_address text,
  registered_office_postal_code text, registered_office_city text,
  registered_office_country text DEFAULT 'France',
  siren text, siret text, rcs_city text, rne_registration text,
  vat_number text, professional_email text, professional_phone text,
  publication_director_name text, legal_representative_name text,
  hosting_provider_name text, hosting_provider_address text,
  hosting_provider_phone text, hosting_provider_website text,
  privacy_contact_email text, data_protection_officer_name text,
  data_protection_officer_email text,
  complaint_email text, complaint_postal_address text, support_email text,
  professional_insurance_name text, professional_insurance_policy_reference text,
  professional_insurance_coverage_area text,
  mediator_name text, mediator_address text, mediator_website text,
  governing_law text DEFAULT 'Droit français',
  competent_court_information text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT ON public.platform_legal_settings TO anon, authenticated;
GRANT ALL ON public.platform_legal_settings TO service_role;
ALTER TABLE public.platform_legal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read platform legal settings" ON public.platform_legal_settings FOR SELECT USING (true);
CREATE POLICY "owner writes platform legal" ON public.platform_legal_settings
  FOR ALL TO authenticated
  USING (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));
INSERT INTO public.platform_legal_settings (singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.legal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code text NOT NULL,
  title text NOT NULL,
  audience text NOT NULL DEFAULT 'public',
  scope text NOT NULL DEFAULT 'platform',
  language text NOT NULL DEFAULT 'fr',
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','under_review','approved','published','archived')),
  content text NOT NULL DEFAULT '',
  content_hash text,
  summary text,
  effective_date date,
  published_at timestamptz,
  archived_at timestamptz,
  requires_acceptance boolean NOT NULL DEFAULT false,
  requires_reacceptance boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_code, version, language, scope)
);
GRANT SELECT ON public.legal_documents TO anon, authenticated;
GRANT ALL ON public.legal_documents TO service_role;
ALTER TABLE public.legal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads published docs" ON public.legal_documents
  FOR SELECT USING (status = 'published' OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "owner writes legal docs" ON public.legal_documents
  FOR ALL TO authenticated
  USING (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));

CREATE OR REPLACE FUNCTION public.legal_documents_lock_published()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'published' AND NEW.status = 'published' THEN
    IF NEW.content IS DISTINCT FROM OLD.content
      OR NEW.effective_date IS DISTINCT FROM OLD.effective_date
      OR NEW.version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'Une version publiée ne peut plus être modifiée. Créez une nouvelle version.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_legal_documents_lock ON public.legal_documents;
CREATE TRIGGER trg_legal_documents_lock BEFORE UPDATE ON public.legal_documents
  FOR EACH ROW EXECUTE FUNCTION public.legal_documents_lock_published();

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_identifier text,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  order_id uuid,
  document_id uuid REFERENCES public.legal_documents(id) ON DELETE RESTRICT,
  document_code text NOT NULL,
  document_version integer NOT NULL,
  content_hash text,
  acceptance_type text NOT NULL DEFAULT 'checkbox',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  session_id text,
  ip_address_if_authorized inet,
  user_agent_if_authorized text
);
GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;
GRANT INSERT ON public.legal_acceptances TO anon;
GRANT ALL ON public.legal_acceptances TO service_role;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own acceptances" ON public.legal_acceptances
  FOR SELECT TO authenticated USING (auth.uid() = user_id
    OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "anyone inserts own acceptance" ON public.legal_acceptances
  FOR INSERT TO authenticated, anon
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON public.legal_acceptances(user_id);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_order ON public.legal_acceptances(order_id);

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number text UNIQUE NOT NULL DEFAULT ('SIG-' || to_char(now(),'YYYYMMDD') || '-' || substr(md5(random()::text),1,6)),
  category text NOT NULL,
  target_type text,
  target_id text,
  target_url text,
  target_shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  description text NOT NULL,
  legal_basis text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name text, reporter_email text, reporter_phone text,
  good_faith_declared boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','under_review','action_taken','rejected','forwarded','closed')),
  decision text, decision_reason text, decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT INSERT ON public.content_reports TO anon;
GRANT ALL ON public.content_reports TO service_role;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporter reads own reports" ON public.content_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_user_id
    OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "anyone can report" ON public.content_reports
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "owner updates reports" ON public.content_reports
  FOR UPDATE TO authenticated
  USING (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text UNIQUE NOT NULL DEFAULT ('DPO-' || to_char(now(),'YYYYMMDD') || '-' || substr(md5(random()::text),1,6)),
  request_type text NOT NULL CHECK (request_type IN ('access','rectification','deletion','opposition','limitation','portability','other')),
  requester_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_full_name text NOT NULL,
  requester_email text NOT NULL,
  identity_verification text,
  description text,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','identity_check','processing','completed','rejected','forwarded')),
  due_date date NOT NULL DEFAULT (now() + interval '30 days')::date,
  response text,
  handled_by uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.privacy_requests TO anon, authenticated;
GRANT SELECT ON public.privacy_requests TO authenticated;
GRANT ALL ON public.privacy_requests TO service_role;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requester reads own privacy request" ON public.privacy_requests
  FOR SELECT TO authenticated USING (auth.uid() = requester_user_id
    OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "anyone submits privacy request" ON public.privacy_requests
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "owner manages privacy requests" ON public.privacy_requests
  FOR UPDATE TO authenticated
  USING (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));

CREATE TABLE IF NOT EXISTS public.cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pseudonym_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  policy_version text NOT NULL,
  necessary boolean NOT NULL DEFAULT true,
  preferences boolean NOT NULL DEFAULT false,
  analytics boolean NOT NULL DEFAULT false,
  external_features boolean NOT NULL DEFAULT false,
  advertising boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '13 months'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.cookie_consents TO anon, authenticated;
GRANT SELECT ON public.cookie_consents TO authenticated;
GRANT ALL ON public.cookie_consents TO service_role;
ALTER TABLE public.cookie_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert cookie consent" ON public.cookie_consents
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "user reads own consent" ON public.cookie_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner_bpei(auth.uid()));

CREATE TABLE IF NOT EXISTS public.suspension_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES auth.users(id),
  original_decision text,
  observations text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','accepted','rejected','withdrawn')),
  decision_reason text,
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.suspension_appeals TO authenticated;
GRANT ALL ON public.suspension_appeals TO service_role;
ALTER TABLE public.suspension_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read own appeals" ON public.suspension_appeals
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id)
    OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "shop members create appeals" ON public.suspension_appeals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) AND submitted_by = auth.uid());
CREATE POLICY "owner updates appeals" ON public.suspension_appeals
  FOR UPDATE TO authenticated
  USING (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));

CREATE TABLE IF NOT EXISTS public.seller_legal_profiles (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  legal_name text, commercial_name text, legal_form text,
  representative_name text, registered_address text,
  siren text, siret text, rcs_or_rne_registration text, vat_number text,
  professional_phone text, professional_email text,
  consumer_service_email text, consumer_service_phone text,
  mediator_name text, mediator_address text, mediator_website text,
  insurance_name text, insurance_reference text, insurance_expiration date,
  payment_account_provider text, payment_account_identifier_masked text,
  legal_status text NOT NULL DEFAULT 'incomplete' CHECK (legal_status IN ('incomplete','submitted','under_review','correction_required','verified','suspended','expired')),
  self_certification_accepted_at timestamptz,
  self_certification_version text,
  last_verified_at timestamptz,
  next_review_at timestamptz,
  verified_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.seller_legal_profiles TO authenticated;
GRANT ALL ON public.seller_legal_profiles TO service_role;
ALTER TABLE public.seller_legal_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop reads own legal profile" ON public.seller_legal_profiles
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id)
    OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "shop manager writes legal profile" ON public.seller_legal_profiles
  FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) OR public.is_owner_bpei(auth.uid()))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id) OR public.is_owner_bpei(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_seller_public_legal(_shop_id uuid)
RETURNS TABLE (
  legal_name text, commercial_name text, legal_form text,
  siren text, siret text, rcs_or_rne_registration text, vat_number text,
  professional_email text, professional_phone text,
  mediator_name text, mediator_website text,
  legal_status text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT legal_name, commercial_name, legal_form,
         siren, siret, rcs_or_rne_registration, vat_number,
         professional_email, professional_phone,
         mediator_name, mediator_website, legal_status
  FROM public.seller_legal_profiles
  WHERE shop_id = _shop_id
    AND legal_status IN ('verified','under_review','submitted');
$$;
GRANT EXECUTE ON FUNCTION public.get_seller_public_legal(uuid) TO anon, authenticated;

INSERT INTO public.legal_documents (document_code, title, version, status, requires_acceptance, summary)
VALUES
  ('legal_notice','Mentions légales',1,'draft',false,'Modèle préparatoire — à valider juridiquement.'),
  ('privacy_policy','Politique de confidentialité',1,'draft',false,'Modèle préparatoire — à valider juridiquement.'),
  ('cookie_policy','Politique cookies',1,'draft',false,'Modèle préparatoire — à valider juridiquement.'),
  ('website_terms','Conditions générales d''utilisation',1,'draft',true,'Modèle préparatoire — à valider juridiquement.'),
  ('beta_terms','Conditions de la bêta',1,'draft',true,'Modèle préparatoire — à valider juridiquement.'),
  ('subscription_terms','Conditions générales des abonnements BPEI',1,'draft',true,'Modèle préparatoire — à valider juridiquement.'),
  ('complaint_policy','Politique de réclamations',1,'draft',false,''),
  ('directory_admission','Règles d''admission à l''annuaire',1,'draft',false,''),
  ('verified_badge_rules','Règles du badge Vérifié BPEI',1,'draft',false,''),
  ('ranking_policy','Méthode de classement',1,'draft',false,''),
  ('review_policy','Politique des avis',1,'draft',false,''),
  ('moderation_policy','Règles de modération',1,'draft',false,''),
  ('reporting_policy','Procédure de signalement',1,'draft',false,''),
  ('suspension_policy','Suspension et recours',1,'draft',false,''),
  ('marketplace_information','Rôle de BPEI dans les commandes',1,'draft',false,''),
  ('seller_rules','Règles applicables aux vendeurs',1,'draft',true,''),
  ('payment_link_terms','Conditions des liens de paiement',1,'draft',false,'')
ON CONFLICT DO NOTHING;