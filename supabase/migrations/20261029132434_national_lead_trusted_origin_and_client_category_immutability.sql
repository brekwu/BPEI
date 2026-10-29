-- Preserve trusted origin attribution and consumer privacy for partner-owned CRM.
DROP POLICY bpei_leads_insert_verified_legal_scope ON public.bpei_partner_leads;
CREATE POLICY bpei_leads_insert_verified_legal_scope ON public.bpei_partner_leads
 FOR INSERT TO authenticated WITH CHECK(
  created_by=(SELECT auth.uid()) AND
  (
   EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
   OR (partner_id=(SELECT auth.uid()) AND source='partner')
  ) AND EXISTS(
   SELECT 1 FROM public.bpei_launch_controls c
   JOIN public.bpei_legal_acceptances acc
   ON acc.legal_version=c.legal_version AND acc.user_id=partner_id
   WHERE c.id=true AND c.legal_documents_published=true
  )
 );
CREATE OR REPLACE FUNCTION bpei_private.prevent_lead_identity_change()
 RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.partner_id IS DISTINCT FROM OLD.partner_id
 OR NEW.created_by IS DISTINCT FROM OLD.created_by
 OR NEW.client_type IS DISTINCT FROM OLD.client_type
 OR NEW.client_email IS DISTINCT FROM OLD.client_email
 OR NEW.source IS DISTINCT FROM OLD.source
 OR NEW.legal_basis IS DISTINCT FROM OLD.legal_basis
 OR NEW.legal_evidence IS DISTINCT FROM OLD.legal_evidence
 OR NEW.opportunity_title IS DISTINCT FROM OLD.opportunity_title
 THEN RAISE EXCEPTION 'Lead ownership, client category, source and privacy basis are immutable'
 USING ERRCODE='42501'; END IF;
 NEW.updated_at:=now();
 RETURN NEW;
END $$;
