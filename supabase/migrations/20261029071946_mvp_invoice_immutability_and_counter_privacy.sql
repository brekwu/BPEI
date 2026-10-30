-- BPEI MVP commercial hardening: immutable issued invoices and internal counter access.
CREATE INDEX bpei_service_quotes_creator_idx
 ON public.bpei_service_quotes(created_by);
-- Explicit deny policy keeps bookkeeping counters sealed and removes the informational advisor.
CREATE POLICY bpei_invoice_counters_no_direct_read
 ON public.bpei_invoice_counters FOR SELECT TO authenticated USING(false);
CREATE OR REPLACE FUNCTION bpei_private.mvp_reject_invoice_mutation()
 RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'An issued invoice cannot be modified or removed; issue a separate credit note in a future validated workflow'
  USING ERRCODE='42501';
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_reject_invoice_mutation()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_invoice_immutable
 BEFORE UPDATE OR DELETE ON public.bpei_service_invoices
 FOR EACH ROW EXECUTE FUNCTION bpei_private.mvp_reject_invoice_mutation();
