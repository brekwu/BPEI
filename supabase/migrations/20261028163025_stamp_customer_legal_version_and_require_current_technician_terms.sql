ALTER TABLE public.bpei_inquiries ADD COLUMN legal_version text;
CREATE OR REPLACE FUNCTION bpei_private.stamp_public_inquiry_legal_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_version text;
BEGIN
  SELECT ctrl.legal_version INTO v_version FROM public.bpei_launch_controls ctrl
   WHERE ctrl.id=true AND ctrl.legal_documents_published=true;
  IF v_version IS NULL OR NEW.consent_accepted IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Published legal documents and explicit acknowledgement required' USING ERRCODE='22023';
  END IF;
  NEW.legal_version:=v_version;
  NEW.consent_at:=now();
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION bpei_private.stamp_public_inquiry_legal_version() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_stamp_inquiry_legal_version BEFORE INSERT ON public.bpei_inquiries
FOR EACH ROW EXECUTE FUNCTION bpei_private.stamp_public_inquiry_legal_version();

CREATE OR REPLACE FUNCTION bpei_private.require_current_candidate_acceptance_on_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM public.bpei_launch_controls c
    JOIN public.bpei_legal_acceptances a ON a.legal_version=c.legal_version
      AND a.user_id=NEW.independent_id
    WHERE c.id=true AND c.legal_documents_published=true
  ) THEN RAISE EXCEPTION 'Independent must accept current legal version before assignment' USING ERRCODE='22023';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION bpei_private.require_current_candidate_acceptance_on_assignment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_check_current_legal_at_mission_creation BEFORE INSERT ON public.independent_requests
FOR EACH ROW EXECUTE FUNCTION bpei_private.require_current_candidate_acceptance_on_assignment();
