CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.legal_role_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_code TEXT NOT NULL, feature_name TEXT NOT NULL, feature_category TEXT,
  service_provider_role TEXT, contracting_party TEXT, invoicing_party TEXT,
  customer_support_party TEXT, operational_responsibility TEXT,
  platform_role TEXT, shop_role TEXT, independent_role TEXT, customer_role TEXT,
  rgpd_platform_role TEXT, rgpd_professional_role TEXT,
  applicable_contracts TEXT[] DEFAULT '{}', required_insurances TEXT[] DEFAULT '{}',
  legal_validation_status TEXT NOT NULL DEFAULT 'not_reviewed',
  activation_status TEXT NOT NULL DEFAULT 'architecture_only',
  notes TEXT, version INT NOT NULL DEFAULT 1, effective_date TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id), updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feature_code, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_role_definitions TO authenticated;
GRANT ALL ON public.legal_role_definitions TO service_role;
ALTER TABLE public.legal_role_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_roles_read ON public.legal_role_definitions FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'));
CREATE POLICY legal_roles_write ON public.legal_role_definitions FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_legal_roles_updated BEFORE UPDATE ON public.legal_role_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.legal_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, subject TEXT, description TEXT,
  options_considered TEXT, selected_option TEXT, justification TEXT, consequences TEXT,
  impacted_features TEXT[] DEFAULT '{}', impacted_documents TEXT[] DEFAULT '{}',
  validation_required_from TEXT, status TEXT NOT NULL DEFAULT 'draft',
  decision_date TIMESTAMPTZ, effective_date TIMESTAMPTZ,
  supersedes UUID REFERENCES public.legal_decisions(id),
  created_by UUID REFERENCES auth.users(id), reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_decisions TO authenticated;
GRANT ALL ON public.legal_decisions TO service_role;
ALTER TABLE public.legal_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_decisions_all ON public.legal_decisions FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_legal_decisions_updated BEFORE UPDATE ON public.legal_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.processing_activity_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_code TEXT NOT NULL, processing_name TEXT NOT NULL, purpose TEXT,
  data_categories TEXT[] DEFAULT '{}', data_subjects TEXT[] DEFAULT '{}', legal_basis TEXT,
  platform_role TEXT NOT NULL DEFAULT 'to_be_determined',
  professional_role TEXT NOT NULL DEFAULT 'to_be_determined',
  joint_controller_possible BOOLEAN NOT NULL DEFAULT false,
  recipients TEXT[] DEFAULT '{}', retention_rule TEXT, security_requirements TEXT,
  dpa_required BOOLEAN NOT NULL DEFAULT false, dpia_review_required BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft', version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (processing_code, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_activity_roles TO authenticated;
GRANT ALL ON public.processing_activity_roles TO service_role;
ALTER TABLE public.processing_activity_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY processing_roles_all ON public.processing_activity_roles FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_processing_roles_updated BEFORE UPDATE ON public.processing_activity_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE, active_retention TEXT, post_termination_retention TEXT,
  legal_retention TEXT, backup_retention TEXT,
  anonymization_possible BOOLEAN NOT NULL DEFAULT false,
  deletion_method TEXT, justification TEXT,
  reviewed_at TIMESTAMPTZ, reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_retention_policies TO authenticated;
GRANT ALL ON public.data_retention_policies TO service_role;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY retention_all ON public.data_retention_policies FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_retention_updated BEFORE UPDATE ON public.data_retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.data_deletion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  categories_deleted TEXT[] DEFAULT '{}', categories_retained TEXT[] DEFAULT '{}',
  retention_reason TEXT, errors TEXT,
  executed_by UUID REFERENCES auth.users(id), audit_id UUID,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_deletion_jobs TO authenticated;
GRANT ALL ON public.data_deletion_jobs TO service_role;
ALTER TABLE public.data_deletion_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY deletion_all ON public.data_deletion_jobs FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_deletion_updated BEFORE UPDATE ON public.data_deletion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  scope TEXT[] DEFAULT '{}', format TEXT NOT NULL DEFAULT 'zip',
  status TEXT NOT NULL DEFAULT 'requested',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_at TIMESTAMPTZ, expires_at TIMESTAMPTZ, downloaded_at TIMESTAMPTZ,
  file_path TEXT, file_hash TEXT, failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_export_requests TO authenticated;
GRANT ALL ON public.data_export_requests TO service_role;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY export_all ON public.data_export_requests FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.has_platform_role(auth.uid(), 'owner_bpei'))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_export_updated BEFORE UPDATE ON public.data_export_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.professional_verification_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  professional_user_id UUID REFERENCES auth.users(id),
  check_type TEXT NOT NULL, result TEXT, source TEXT,
  checked_at TIMESTAMPTZ, checked_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ, notes TEXT, evidence_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_verification_checks TO authenticated;
GRANT ALL ON public.professional_verification_checks TO service_role;
ALTER TABLE public.professional_verification_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY verif_checks_all ON public.professional_verification_checks FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'));
CREATE TRIGGER trg_verif_checks_updated BEFORE UPDATE ON public.professional_verification_checks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(), detected_by UUID REFERENCES auth.users(id),
  severity TEXT NOT NULL DEFAULT 'low', status TEXT NOT NULL DEFAULT 'detected',
  affected_systems TEXT[] DEFAULT '{}', affected_shops UUID[] DEFAULT '{}',
  affected_data_categories TEXT[] DEFAULT '{}', estimated_people_affected INT,
  risk_level TEXT, containment_actions TEXT, corrective_actions TEXT,
  notification_required BOOLEAN NOT NULL DEFAULT false,
  authority_notification_status TEXT, affected_party_notification_status TEXT,
  evidence TEXT, resolved_at TIMESTAMPTZ, post_incident_review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_incidents TO authenticated;
GRANT ALL ON public.security_incidents TO service_role;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY incidents_all ON public.security_incidents FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'));
CREATE TRIGGER trg_incidents_updated BEFORE UPDATE ON public.security_incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.admin_access_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  reason TEXT NOT NULL, reason_category TEXT NOT NULL, ticket_reference TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, ended_at TIMESTAMPTZ,
  pages_accessed TEXT[] DEFAULT '{}', sensitive_actions JSONB DEFAULT '[]'::jsonb,
  export_performed BOOLEAN NOT NULL DEFAULT false, files_downloaded INT NOT NULL DEFAULT 0,
  ip_address TEXT, session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.admin_access_sessions TO authenticated;
GRANT ALL ON public.admin_access_sessions TO service_role;
ALTER TABLE public.admin_access_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_access_read ON public.admin_access_sessions FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR admin_user_id = auth.uid());
CREATE POLICY admin_access_insert ON public.admin_access_sessions FOR INSERT TO authenticated
  WITH CHECK (admin_user_id = auth.uid() AND (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei')));
CREATE POLICY admin_access_update ON public.admin_access_sessions FOR UPDATE TO authenticated
  USING (admin_user_id = auth.uid()) WITH CHECK (admin_user_id = auth.uid());

CREATE TABLE public.platform_insurance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_type TEXT NOT NULL, provider TEXT, policy_number TEXT,
  covered_activities TEXT[] DEFAULT '{}', coverage_amount NUMERIC, deductible NUMERIC,
  territory TEXT, start_date DATE, expiration_date DATE,
  document_path TEXT, status TEXT NOT NULL DEFAULT 'active',
  last_reviewed_at TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_insurance_records TO authenticated;
GRANT ALL ON public.platform_insurance_records TO service_role;
ALTER TABLE public.platform_insurance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY insurance_all ON public.platform_insurance_records FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_insurance_updated BEFORE UPDATE ON public.platform_insurance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shop_independent_framework_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  independent_user_id UUID NOT NULL REFERENCES auth.users(id),
  document_id UUID REFERENCES public.legal_documents(id), document_version TEXT, content_hash TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  shop_accepted_at TIMESTAMPTZ, shop_accepted_by UUID REFERENCES auth.users(id),
  independent_accepted_at TIMESTAMPTZ,
  effective_date DATE, end_date DATE, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_independent_framework_agreements TO authenticated;
GRANT ALL ON public.shop_independent_framework_agreements TO service_role;
ALTER TABLE public.shop_independent_framework_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY framework_all ON public.shop_independent_framework_agreements FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR independent_user_id = auth.uid() OR public.has_platform_role(auth.uid(), 'owner_bpei'))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR independent_user_id = auth.uid() OR public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_framework_updated BEFORE UPDATE ON public.shop_independent_framework_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mission_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL,
  framework_agreement_id UUID REFERENCES public.shop_independent_framework_agreements(id) ON DELETE SET NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  independent_user_id UUID NOT NULL REFERENCES auth.users(id),
  customer_contracting_party TEXT, customer_id UUID REFERENCES public.customers(id),
  address TEXT, scheduled_start TIMESTAMPTZ, scheduled_end TIMESTAMPTZ,
  subject TEXT, service_details TEXT, device_details TEXT, entrusted_material TEXT,
  price_customer NUMERIC, compensation_independent NUMERIC, expenses TEXT,
  deadlines TEXT, liability_terms TEXT, insurance_requirements TEXT,
  transmitted_data TEXT, confidentiality TEXT, deliverables TEXT,
  report_requirements TEXT, cancellation_terms TEXT, reservations TEXT,
  independent_accepted_at TIMESTAMPTZ, independent_acceptance_hash TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, reference)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mission_orders TO authenticated;
GRANT ALL ON public.mission_orders TO service_role;
ALTER TABLE public.mission_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY mission_all ON public.mission_orders FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR independent_user_id = auth.uid() OR public.has_platform_role(auth.uid(), 'owner_bpei'))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_mission_updated BEFORE UPDATE ON public.mission_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.electronic_invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, provider TEXT, external_reference TEXT, status TEXT,
  payload_metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.electronic_invoice_events TO authenticated;
GRANT ALL ON public.electronic_invoice_events TO service_role;
ALTER TABLE public.electronic_invoice_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY einvoice_all ON public.electronic_invoice_events FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'));

CREATE TABLE public.sensitive_module_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code TEXT NOT NULL UNIQUE, module_name TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  legal_review_required BOOLEAN NOT NULL DEFAULT true,
  accounting_review_required BOOLEAN NOT NULL DEFAULT false,
  insurance_review_required BOOLEAN NOT NULL DEFAULT false,
  technical_audit_required BOOLEAN NOT NULL DEFAULT false,
  current_status TEXT NOT NULL DEFAULT 'blocked',
  blockers TEXT, approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ, expiration_or_review_date TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensitive_module_approvals TO authenticated;
GRANT ALL ON public.sensitive_module_approvals TO service_role;
ALTER TABLE public.sensitive_module_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY sensitive_read ON public.sensitive_module_approvals FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'));
CREATE POLICY sensitive_write ON public.sensitive_module_approvals FOR ALL TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei'))
  WITH CHECK (public.has_platform_role(auth.uid(), 'owner_bpei'));
CREATE TRIGGER trg_sensitive_updated BEFORE UPDATE ON public.sensitive_module_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sensitive_module_approvals (module_code, module_name, risk_level, current_status, notes) VALUES
  ('cash_register', 'Caisse', 'high', 'architecture_only', 'À faire valider comptablement.'),
  ('ecommerce', 'E-commerce', 'high', 'architecture_only', NULL),
  ('commissions', 'Commissions financières', 'critical', 'blocked', 'Décision juridique préalable requise.'),
  ('missions', 'Missions sous-traitées', 'high', 'architecture_only', 'Contrat-cadre à valider.'),
  ('inter_shop_stock', 'Stock inter-boutiques', 'medium', 'architecture_only', NULL),
  ('exclusive_contracts', 'Contrats exclusifs', 'high', 'blocked', 'Risque de requalification.'),
  ('customer_signature', 'Signature client', 'medium', 'architecture_only', NULL),
  ('electronic_invoicing', 'Facturation électronique', 'critical', 'architecture_only', 'Plateforme agréée non configurée.'),
  ('sensitive_data_processing', 'Traitement de données sensibles', 'critical', 'blocked', 'DPIA requise.'),
  ('professional_verification', 'Vérification des professionnels', 'high', 'architecture_only', NULL);

INSERT INTO public.data_retention_policies (category, active_retention, post_termination_retention, legal_retention, backup_retention, anonymization_possible, deletion_method, justification) VALUES
  ('customers', 'Durée de la relation', '90 jours', 'À définir', '35 jours', true, 'anonymization', 'Modèle préparatoire, à faire valider.'),
  ('invoices', 'Durée de la relation', '10 ans', '10 ans (obligation comptable à confirmer)', '35 jours', false, 'retention_locked', 'Obligation légale à confirmer.'),
  ('repairs', 'Durée de la relation', '2 ans', 'À définir', '35 jours', true, 'anonymization', NULL),
  ('messages', 'Durée de la relation', '30 jours', 'À définir', '35 jours', true, 'hard_delete', NULL),
  ('media', 'Durée de la relation', '30 jours', 'À définir', '35 jours', false, 'hard_delete', NULL),
  ('logs_access', '12 mois', '6 mois', '1 an (à confirmer)', '35 jours', false, 'hard_delete', NULL);