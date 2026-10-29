CREATE TABLE public.owner_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical','success')),
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  entity_type TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  read_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX owner_notifications_created_idx ON public.owner_notifications (created_at DESC);
CREATE INDEX owner_notifications_unread_idx ON public.owner_notifications (read_at) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.owner_notifications TO authenticated;
GRANT ALL ON public.owner_notifications TO service_role;

ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read notifications" ON public.owner_notifications
  FOR SELECT TO authenticated
  USING (public.is_owner_bpei(auth.uid()));

CREATE POLICY "Owners can mark notifications" ON public.owner_notifications
  FOR UPDATE TO authenticated
  USING (public.is_owner_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_owner_notification(
  _category TEXT, _severity TEXT, _title TEXT, _body TEXT,
  _link_url TEXT, _entity_type TEXT, _entity_id UUID
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO public.owner_notifications (category, severity, title, body, link_url, entity_type, entity_id)
  VALUES (_category, COALESCE(_severity,'info'), _title, _body, _link_url, _entity_type, _entity_id)
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_owner_notification_read(_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.owner_notifications
  SET read_at = now(), read_by = auth.uid()
  WHERE id = _id AND read_at IS NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.mark_all_owner_notifications_read()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE n INTEGER;
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.owner_notifications
  SET read_at = now(), read_by = auth.uid()
  WHERE read_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

GRANT EXECUTE ON FUNCTION public.mark_owner_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_owner_notifications_read() TO authenticated;

-- Trigger: shop_applications INSERT
CREATE OR REPLACE FUNCTION public.notify_owner_new_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.create_owner_notification(
    'candidature','warning','Nouvelle candidature',
    COALESCE(NEW.company_name, NEW.contact_name, 'Candidature reçue'),
    '/owner/candidatures','shop_application',NEW.id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_owner_new_application ON public.shop_applications;
CREATE TRIGGER trg_notify_owner_new_application
AFTER INSERT ON public.shop_applications
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_new_application();

-- Trigger: shops publication submitted
CREATE OR REPLACE FUNCTION public.notify_owner_publication_submitted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.public_profile_status = 'submitted'
     AND (OLD.public_profile_status IS DISTINCT FROM NEW.public_profile_status) THEN
    PERFORM public.create_owner_notification(
      'publication','warning','Publication à valider',
      COALESCE(NEW.public_name, NEW.name, 'Boutique'),
      '/owner/publications','shop',NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_owner_publication_submitted ON public.shops;
CREATE TRIGGER trg_notify_owner_publication_submitted
AFTER UPDATE OF public_profile_status ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_publication_submitted();

-- Trigger: shops legal submitted
CREATE OR REPLACE FUNCTION public.notify_owner_legal_submitted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.legal_status = 'submitted'
     AND (OLD.legal_status IS DISTINCT FROM NEW.legal_status) THEN
    PERFORM public.create_owner_notification(
      'juridique','warning','Dossier juridique à examiner',
      COALESCE(NEW.name,'Boutique'),
      '/owner/juridique','shop',NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_owner_legal_submitted ON public.shops;
CREATE TRIGGER trg_notify_owner_legal_submitted
AFTER UPDATE OF legal_status ON public.shops
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_legal_submitted();

-- Trigger: verification_documents
CREATE OR REPLACE FUNCTION public.notify_owner_verification_submitted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP='INSERT' AND NEW.review_status='submitted')
     OR (TG_OP='UPDATE' AND NEW.review_status='submitted'
         AND OLD.review_status IS DISTINCT FROM NEW.review_status) THEN
    PERFORM public.create_owner_notification(
      'verification','warning','Vérification d''identité à traiter',
      'Document soumis','/owner/verifications','verification_document',NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_owner_verification_submitted ON public.verification_documents;
CREATE TRIGGER trg_notify_owner_verification_submitted
AFTER INSERT OR UPDATE OF review_status ON public.verification_documents
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_verification_submitted();

-- Trigger: partner_agreements
CREATE OR REPLACE FUNCTION public.notify_owner_agreement_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.create_owner_notification(
      'partenariat','info','Nouvel accord de partenariat',
      'Statut : '||COALESCE(NEW.status,'nouveau'),
      '/owner/partenariats','partner_agreement',NEW.id);
    RETURN NEW;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('expired','suspended','terminated') THEN
      PERFORM public.create_owner_notification(
        'partenariat','critical','Accord '||NEW.status,
        'Accord '||NEW.id::text,'/owner/partenariats','partner_agreement',NEW.id);
    ELSIF NEW.status IN ('proposed','pending_signature') THEN
      PERFORM public.create_owner_notification(
        'partenariat','warning','Accord en attente de signature',
        'Accord '||NEW.id::text,'/owner/partenariats','partner_agreement',NEW.id);
    ELSIF NEW.status='active' THEN
      PERFORM public.create_owner_notification(
        'partenariat','success','Accord activé',
        'Accord '||NEW.id::text,'/owner/partenariats','partner_agreement',NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_owner_agreement_change ON public.partner_agreements;
CREATE TRIGGER trg_notify_owner_agreement_change
AFTER INSERT OR UPDATE OF status ON public.partner_agreements
FOR EACH ROW EXECUTE FUNCTION public.notify_owner_agreement_change();