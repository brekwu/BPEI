-- Private, user-entered bookkeeping journal. Not a bank reconciliation or official Urssaf filing.
CREATE TABLE public.bpei_partner_finance_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE CASCADE,
 entry_kind text NOT NULL CHECK(entry_kind IN ('revenue','expense')),
 entry_date date NOT NULL CHECK(entry_date BETWEEN DATE '2020-01-01' AND DATE '2100-12-31'),
 category text NOT NULL CHECK(char_length(btrim(category)) BETWEEN 3 AND 100),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 1 AND 999999999),
 vat_cents bigint NOT NULL DEFAULT 0 CHECK(vat_cents>=0 AND vat_cents<=amount_cents),
 evidence_reference text NOT NULL CHECK(char_length(btrim(evidence_reference)) BETWEEN 12 AND 200),
 notes text NOT NULL DEFAULT '' CHECK(char_length(notes)<=800),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','void')),
 voided_at timestamptz,
 void_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,entry_kind,evidence_reference),
 CHECK((status='active' AND voided_at IS NULL AND void_reason IS NULL)
 OR (status='void' AND voided_at IS NOT NULL AND char_length(btrim(void_reason)) BETWEEN 15 AND 400))
);
CREATE INDEX bpei_finance_owner_date_idx
 ON public.bpei_partner_finance_entries(owner_id,entry_date DESC);
ALTER TABLE public.bpei_partner_finance_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_partner_finance_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.bpei_partner_finance_entries TO authenticated;
CREATE POLICY bpei_finance_self_read ON public.bpei_partner_finance_entries
 FOR SELECT TO authenticated USING(owner_id=(SELECT auth.uid()));
CREATE POLICY bpei_finance_insert_self_documented ON public.bpei_partner_finance_entries
 FOR INSERT TO authenticated WITH CHECK(
  owner_id=(SELECT auth.uid()) AND status='active' AND voided_at IS NULL AND void_reason IS NULL
  AND EXISTS(SELECT 1 FROM public.bpei_launch_controls l
   JOIN public.bpei_legal_acceptances a ON a.user_id=owner_id AND a.legal_version=l.legal_version
   WHERE l.id=true AND l.legal_documents_published=true)
 );
CREATE POLICY bpei_finance_void_self ON public.bpei_partner_finance_entries
 FOR UPDATE TO authenticated USING(owner_id=(SELECT auth.uid()))
 WITH CHECK(owner_id=(SELECT auth.uid()));
CREATE FUNCTION bpei_private.guard_finance_entry_correction()
 RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
 OR NEW.entry_kind IS DISTINCT FROM OLD.entry_kind
 OR NEW.entry_date IS DISTINCT FROM OLD.entry_date
 OR NEW.category IS DISTINCT FROM OLD.category
 OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
 OR NEW.vat_cents IS DISTINCT FROM OLD.vat_cents
 OR NEW.evidence_reference IS DISTINCT FROM OLD.evidence_reference
 OR NEW.notes IS DISTINCT FROM OLD.notes
 OR NEW.created_at IS DISTINCT FROM OLD.created_at
 OR OLD.status<>'active' OR NEW.status<>'void'
 OR NEW.voided_at IS NULL OR NEW.void_reason IS NULL
 OR char_length(btrim(NEW.void_reason)) NOT BETWEEN 15 AND 400
 THEN RAISE EXCEPTION 'Accounting entry immutable, only justified voiding allowed'
 USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bpei_private.guard_finance_entry_correction() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_guard_finance_correction
 BEFORE UPDATE ON public.bpei_partner_finance_entries
 FOR EACH ROW EXECUTE FUNCTION bpei_private.guard_finance_entry_correction();
