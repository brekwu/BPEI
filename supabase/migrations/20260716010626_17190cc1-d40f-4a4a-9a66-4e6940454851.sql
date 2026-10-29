-- =====================================================================
-- PHASE 3 BPEI — Module financier (devis, factures, paiements, avoirs)
-- =====================================================================

-- ---------- ENUMS ----------
CREATE TYPE public.quote_status AS ENUM (
  'draft','sent','viewed','accepted','refused','expired','cancelled','converted'
);
CREATE TYPE public.invoice_status AS ENUM (
  'draft','issued','sent','partially_paid','paid','overdue','cancelled_by_credit_note','refunded'
);
CREATE TYPE public.payment_status AS ENUM (
  'pending','confirmed','failed','cancelled','refunded'
);
CREATE TYPE public.payment_method AS ENUM (
  'cash','card_terminal','bank_transfer','cheque','online','other'
);
CREATE TYPE public.document_line_type AS ENUM (
  'service','product','labour','discount','other'
);
CREATE TYPE public.tax_regime AS ENUM (
  'standard','custom','exempt','franchise_base','not_applicable'
);
CREATE TYPE public.document_number_kind AS ENUM ('quote','invoice','credit_note');

-- ---------- SERVICE CATALOG ----------
CREATE TABLE public.service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  line_type public.document_line_type NOT NULL DEFAULT 'service',
  internal_reference TEXT,
  default_quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unité',
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  estimated_duration_minutes INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX idx_service_catalog_shop ON public.service_catalog(shop_id) WHERE archived_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_catalog TO authenticated;
GRANT ALL ON public.service_catalog TO service_role;
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_read_members" ON public.service_catalog FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "catalog_manage_managers" ON public.service_catalog FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE TRIGGER trg_service_catalog_updated BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- SHOP BILLING SETTINGS ----------
CREATE TABLE public.shop_billing_settings (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  legal_name TEXT,
  trade_name TEXT,
  legal_form TEXT,
  billing_address TEXT,
  billing_city TEXT,
  billing_postal_code TEXT,
  billing_country TEXT DEFAULT 'FR',
  siren TEXT,
  siret TEXT,
  rcs TEXT,
  vat_number TEXT,
  tax_regime public.tax_regime NOT NULL DEFAULT 'standard',
  default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  currency TEXT NOT NULL DEFAULT 'EUR',
  iban TEXT,
  bic TEXT,
  payment_terms TEXT,
  payment_due_days INTEGER NOT NULL DEFAULT 30,
  late_penalty TEXT,
  fixed_recovery_indemnity TEXT,
  franchise_base_mention TEXT,
  quote_prefix TEXT NOT NULL DEFAULT 'DEV',
  invoice_prefix TEXT NOT NULL DEFAULT 'FAC',
  credit_note_prefix TEXT NOT NULL DEFAULT 'AVO',
  default_quote_validity_days INTEGER NOT NULL DEFAULT 30,
  default_deposit_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  logo_url TEXT,
  footer_text TEXT,
  extra_mentions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_billing_settings TO authenticated;
GRANT ALL ON public.shop_billing_settings TO service_role;
ALTER TABLE public.shop_billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_read_members" ON public.shop_billing_settings FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "billing_manage" ON public.shop_billing_settings FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE TRIGGER trg_billing_updated BEFORE UPDATE ON public.shop_billing_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- DOCUMENT NUMBER COUNTERS ----------
CREATE TABLE public.document_number_counters (
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  kind public.document_number_kind NOT NULL,
  year INTEGER NOT NULL,
  next_value INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (shop_id, kind, year)
);
GRANT SELECT, INSERT, UPDATE ON public.document_number_counters TO authenticated;
GRANT ALL ON public.document_number_counters TO service_role;
ALTER TABLE public.document_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counters_no_direct" ON public.document_number_counters FOR SELECT TO authenticated USING (false);

-- ---------- QUOTES ----------
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  quote_number TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  issue_date DATE,
  valid_until DATE,
  currency TEXT NOT NULL DEFAULT 'EUR',
  subtotal_excluding_tax_cents INTEGER NOT NULL DEFAULT 0,
  discount_total_cents INTEGER NOT NULL DEFAULT 0,
  tax_total_cents INTEGER NOT NULL DEFAULT 0,
  total_including_tax_cents INTEGER NOT NULL DEFAULT 0,
  deposit_requested_cents INTEGER NOT NULL DEFAULT 0,
  customer_message TEXT,
  internal_notes TEXT,
  terms_snapshot TEXT,
  billing_identity_snapshot JSONB,
  customer_identity_snapshot JSONB,
  document_hash TEXT,
  accepted_at TIMESTAMPTZ,
  accepted_by_name TEXT,
  accepted_ip TEXT,
  accepted_user_agent TEXT,
  refused_at TIMESTAMPTZ,
  refusal_reason TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT quotes_number_unique UNIQUE (shop_id, quote_number)
);
CREATE INDEX idx_quotes_shop ON public.quotes(shop_id);
CREATE INDEX idx_quotes_repair ON public.quotes(repair_id);
CREATE INDEX idx_quotes_status ON public.quotes(shop_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes_read_members" ON public.quotes FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "quotes_insert_members" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "quotes_update_members" ON public.quotes FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "quotes_delete_managers" ON public.quotes FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) AND status = 'draft');
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.quote_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  line_type public.document_line_type NOT NULL DEFAULT 'service',
  catalog_item_id UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unité',
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  line_tax_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_lines_quote ON public.quote_lines(quote_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_lines TO authenticated;
GRANT ALL ON public.quote_lines TO service_role;
ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_lines_all_members" ON public.quote_lines FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE TRIGGER trg_quote_lines_updated BEFORE UPDATE ON public.quote_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- QUOTE PUBLIC TOKENS ----------
CREATE TABLE public.quote_public_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_public_tokens_quote ON public.quote_public_tokens(quote_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_public_tokens TO authenticated;
GRANT ALL ON public.quote_public_tokens TO service_role;
ALTER TABLE public.quote_public_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens_read_members" ON public.quote_public_tokens FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "tokens_manage_members" ON public.quote_public_tokens FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

-- ---------- INVOICES ----------
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  invoice_number TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issue_date DATE,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'EUR',
  subtotal_excluding_tax_cents INTEGER NOT NULL DEFAULT 0,
  discount_total_cents INTEGER NOT NULL DEFAULT 0,
  tax_total_cents INTEGER NOT NULL DEFAULT 0,
  total_including_tax_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  customer_message TEXT,
  internal_notes TEXT,
  billing_identity_snapshot JSONB,
  customer_identity_snapshot JSONB,
  legal_mentions_snapshot TEXT,
  payment_terms_snapshot TEXT,
  document_hash TEXT,
  issued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_number_unique UNIQUE (shop_id, invoice_number)
);
CREATE INDEX idx_invoices_shop ON public.invoices(shop_id);
CREATE INDEX idx_invoices_status ON public.invoices(shop_id, status);
CREATE INDEX idx_invoices_repair ON public.invoices(repair_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_read_members" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "invoices_insert_members" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "invoices_update_members" ON public.invoices FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "invoices_delete_draft_managers" ON public.invoices FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) AND status = 'draft');
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  line_type public.document_line_type NOT NULL DEFAULT 'service',
  catalog_item_id UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unité',
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  line_tax_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_lines TO authenticated;
GRANT ALL ON public.invoice_lines TO service_role;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_lines_all_members" ON public.invoice_lines FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE TRIGGER trg_invoice_lines_updated BEFORE UPDATE ON public.invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- PAYMENTS ----------
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'confirmed',
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_shop ON public.payments(shop_id);
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_read_members" ON public.payments FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "payments_insert_managers" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "payments_update_managers" ON public.payments FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "payments_delete_managers" ON public.payments FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- CREDIT NOTES ----------
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  credit_note_number TEXT,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  issue_date DATE,
  currency TEXT NOT NULL DEFAULT 'EUR',
  subtotal_excluding_tax_cents INTEGER NOT NULL DEFAULT 0,
  tax_total_cents INTEGER NOT NULL DEFAULT 0,
  total_including_tax_cents INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  refunded_amount_cents INTEGER NOT NULL DEFAULT 0,
  refund_method public.payment_method,
  billing_identity_snapshot JSONB,
  customer_identity_snapshot JSONB,
  legal_mentions_snapshot TEXT,
  issued_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credit_notes_number_unique UNIQUE (shop_id, credit_note_number)
);
CREATE INDEX idx_credit_notes_shop ON public.credit_notes(shop_id);
CREATE INDEX idx_credit_notes_invoice ON public.credit_notes(invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_notes TO authenticated;
GRANT ALL ON public.credit_notes TO service_role;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cn_read_members" ON public.credit_notes FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "cn_insert_managers" ON public.credit_notes FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "cn_update_managers" ON public.credit_notes FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE TRIGGER trg_credit_notes_updated BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.credit_note_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  line_tax_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cn_lines_cn ON public.credit_note_lines(credit_note_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_note_lines TO authenticated;
GRANT ALL ON public.credit_note_lines TO service_role;
ALTER TABLE public.credit_note_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cn_lines_all_members" ON public.credit_note_lines FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE TRIGGER trg_cn_lines_updated BEFORE UPDATE ON public.credit_note_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- FONCTIONS (SECURITY DEFINER, search_path fixé, permissions restreintes)
-- =====================================================================

-- Numérotation atomique
CREATE OR REPLACE FUNCTION public.generate_document_number(_shop UUID, _kind public.document_number_kind)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year INTEGER := extract(year FROM now())::int;
  _val INTEGER;
  _prefix TEXT;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _shop) AND NOT public.is_admin_bpei(auth.uid()) THEN
    RAISE EXCEPTION 'access denied';
  END IF;
  SELECT CASE _kind
    WHEN 'quote' THEN COALESCE(sbs.quote_prefix, 'DEV')
    WHEN 'invoice' THEN COALESCE(sbs.invoice_prefix, 'FAC')
    WHEN 'credit_note' THEN COALESCE(sbs.credit_note_prefix, 'AVO')
  END INTO _prefix
  FROM (SELECT 1) s
  LEFT JOIN public.shop_billing_settings sbs ON sbs.shop_id = _shop;
  IF _prefix IS NULL THEN
    _prefix := CASE _kind WHEN 'quote' THEN 'DEV' WHEN 'invoice' THEN 'FAC' ELSE 'AVO' END;
  END IF;
  INSERT INTO public.document_number_counters(shop_id, kind, year, next_value)
  VALUES (_shop, _kind, _year, 2)
  ON CONFLICT (shop_id, kind, year) DO UPDATE
    SET next_value = public.document_number_counters.next_value + 1
  RETURNING next_value - 1 INTO _val;
  RETURN _prefix || '-' || _year::text || '-' || lpad(_val::text, 6, '0');
END; $$;
REVOKE ALL ON FUNCTION public.generate_document_number(UUID, public.document_number_kind) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_document_number(UUID, public.document_number_kind) TO authenticated;

-- Trigger: interdire modification de contenu quand verrouillé
CREATE OR REPLACE FUNCTION public.prevent_modify_locked_quote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    IF NEW.subtotal_excluding_tax_cents IS DISTINCT FROM OLD.subtotal_excluding_tax_cents
       OR NEW.tax_total_cents IS DISTINCT FROM OLD.tax_total_cents
       OR NEW.total_including_tax_cents IS DISTINCT FROM OLD.total_including_tax_cents
       OR NEW.quote_number IS DISTINCT FROM OLD.quote_number
       OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.billing_identity_snapshot IS DISTINCT FROM OLD.billing_identity_snapshot THEN
      RAISE EXCEPTION 'quote is locked';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_quotes_lock BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_modify_locked_quote();

CREATE OR REPLACE FUNCTION public.prevent_modify_locked_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    IF NEW.subtotal_excluding_tax_cents IS DISTINCT FROM OLD.subtotal_excluding_tax_cents
       OR NEW.tax_total_cents IS DISTINCT FROM OLD.tax_total_cents
       OR NEW.total_including_tax_cents IS DISTINCT FROM OLD.total_including_tax_cents
       OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
       OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
       OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
       OR NEW.billing_identity_snapshot IS DISTINCT FROM OLD.billing_identity_snapshot THEN
      RAISE EXCEPTION 'invoice is locked';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_invoices_lock BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_modify_locked_invoice();

-- Bloquer suppression facture émise
CREATE OR REPLACE FUNCTION public.prevent_delete_issued_invoice()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'cannot delete a non-draft invoice';
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER trg_invoices_no_delete BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_issued_invoice();

-- Verrouiller totaux devis/facture: recalcul depuis lignes (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.recalc_quote_totals(_quote_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _shop UUID;
  _sub INTEGER := 0;
  _tax INTEGER := 0;
  _tot INTEGER := 0;
  _disc INTEGER := 0;
BEGIN
  SELECT shop_id INTO _shop FROM public.quotes WHERE id = _quote_id;
  IF _shop IS NULL THEN RAISE EXCEPTION 'quote not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'access denied'; END IF;

  UPDATE public.quote_lines ql SET
    line_subtotal_cents = ROUND(ql.quantity * ql.unit_price_cents * (1 - ql.discount_percent/100.0))::int,
    line_tax_cents = ROUND(ql.quantity * ql.unit_price_cents * (1 - ql.discount_percent/100.0) * ql.tax_rate/100.0)::int,
    line_total_cents = ROUND(ql.quantity * ql.unit_price_cents * (1 - ql.discount_percent/100.0) * (1 + ql.tax_rate/100.0))::int
  WHERE ql.quote_id = _quote_id;

  SELECT COALESCE(SUM(line_subtotal_cents),0), COALESCE(SUM(line_tax_cents),0), COALESCE(SUM(line_total_cents),0)
    INTO _sub, _tax, _tot
  FROM public.quote_lines WHERE quote_id = _quote_id;

  UPDATE public.quotes SET
    subtotal_excluding_tax_cents = _sub,
    tax_total_cents = _tax,
    total_including_tax_cents = _tot,
    discount_total_cents = _disc
  WHERE id = _quote_id AND locked_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.recalc_quote_totals(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_quote_totals(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(_invoice_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _shop UUID; _sub INTEGER := 0; _tax INTEGER := 0; _tot INTEGER := 0;
BEGIN
  SELECT shop_id INTO _shop FROM public.invoices WHERE id = _invoice_id;
  IF _shop IS NULL THEN RAISE EXCEPTION 'invoice not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'access denied'; END IF;

  UPDATE public.invoice_lines il SET
    line_subtotal_cents = ROUND(il.quantity * il.unit_price_cents * (1 - il.discount_percent/100.0))::int,
    line_tax_cents = ROUND(il.quantity * il.unit_price_cents * (1 - il.discount_percent/100.0) * il.tax_rate/100.0)::int,
    line_total_cents = ROUND(il.quantity * il.unit_price_cents * (1 - il.discount_percent/100.0) * (1 + il.tax_rate/100.0))::int
  WHERE il.invoice_id = _invoice_id;

  SELECT COALESCE(SUM(line_subtotal_cents),0), COALESCE(SUM(line_tax_cents),0), COALESCE(SUM(line_total_cents),0)
    INTO _sub, _tax, _tot
  FROM public.invoice_lines WHERE invoice_id = _invoice_id;

  UPDATE public.invoices SET
    subtotal_excluding_tax_cents = _sub,
    tax_total_cents = _tax,
    total_including_tax_cents = _tot,
    amount_due_cents = GREATEST(_tot - amount_paid_cents, 0)
  WHERE id = _invoice_id AND locked_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.recalc_invoice_totals(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_totals(UUID) TO authenticated;

-- Émettre un devis
CREATE OR REPLACE FUNCTION public.issue_quote(_quote_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _shop UUID; _num TEXT; _status public.quote_status;
BEGIN
  SELECT shop_id, status INTO _shop, _status FROM public.quotes WHERE id = _quote_id FOR UPDATE;
  IF _shop IS NULL THEN RAISE EXCEPTION 'quote not found'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'quote already issued'; END IF;
  PERFORM public.recalc_quote_totals(_quote_id);
  _num := public.generate_document_number(_shop, 'quote');
  UPDATE public.quotes SET
    quote_number = _num,
    status = 'sent',
    issue_date = COALESCE(issue_date, current_date),
    valid_until = COALESCE(valid_until, current_date + INTERVAL '30 days'),
    sent_at = now()
  WHERE id = _quote_id;
  RETURN _num;
END; $$;
REVOKE ALL ON FUNCTION public.issue_quote(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_quote(UUID) TO authenticated;

-- Émettre une facture
CREATE OR REPLACE FUNCTION public.issue_invoice(_invoice_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _shop UUID; _num TEXT; _status public.invoice_status; _tot INTEGER; _due_days INTEGER;
BEGIN
  SELECT shop_id, status, total_including_tax_cents INTO _shop, _status, _tot
    FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF _shop IS NULL THEN RAISE EXCEPTION 'invoice not found'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'invoice already issued'; END IF;
  PERFORM public.recalc_invoice_totals(_invoice_id);
  SELECT payment_due_days INTO _due_days FROM public.shop_billing_settings WHERE shop_id = _shop;
  _num := public.generate_document_number(_shop, 'invoice');
  UPDATE public.invoices SET
    invoice_number = _num,
    status = 'issued',
    issue_date = COALESCE(issue_date, current_date),
    due_date = COALESCE(due_date, current_date + (COALESCE(_due_days,30) || ' days')::interval),
    issued_at = now(),
    locked_at = now(),
    amount_due_cents = GREATEST(total_including_tax_cents - amount_paid_cents, 0)
  WHERE id = _invoice_id;
  RETURN _num;
END; $$;
REVOKE ALL ON FUNCTION public.issue_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_invoice(UUID) TO authenticated;

-- Convertir devis accepté en facture (copie des lignes)
CREATE OR REPLACE FUNCTION public.convert_quote_to_invoice(_quote_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _shop UUID; _status public.quote_status; _invoice_id UUID; _q RECORD;
BEGIN
  SELECT * INTO _q FROM public.quotes WHERE id = _quote_id;
  IF _q IS NULL THEN RAISE EXCEPTION 'quote not found'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _q.shop_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _q.status NOT IN ('accepted') THEN RAISE EXCEPTION 'only accepted quotes can be converted'; END IF;

  INSERT INTO public.invoices(shop_id, customer_id, device_id, repair_id, quote_id, currency,
    customer_message, billing_identity_snapshot, customer_identity_snapshot, created_by)
  VALUES (_q.shop_id, _q.customer_id, _q.device_id, _q.repair_id, _q.id, _q.currency,
    _q.customer_message, _q.billing_identity_snapshot, _q.customer_identity_snapshot, auth.uid())
  RETURNING id INTO _invoice_id;

  INSERT INTO public.invoice_lines(shop_id, invoice_id, line_type, catalog_item_id, description,
    quantity, unit, unit_price_cents, discount_percent, tax_rate,
    line_subtotal_cents, line_tax_cents, line_total_cents, display_order)
  SELECT _q.shop_id, _invoice_id, line_type, catalog_item_id, description,
    quantity, unit, unit_price_cents, discount_percent, tax_rate,
    line_subtotal_cents, line_tax_cents, line_total_cents, display_order
  FROM public.quote_lines WHERE quote_id = _quote_id ORDER BY display_order;

  PERFORM public.recalc_invoice_totals(_invoice_id);
  UPDATE public.quotes SET status = 'converted' WHERE id = _quote_id;
  RETURN _invoice_id;
END; $$;
REVOKE ALL ON FUNCTION public.convert_quote_to_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_invoice(UUID) TO authenticated;

-- Enregistrer un paiement
CREATE OR REPLACE FUNCTION public.record_payment(
  _invoice_id UUID, _amount_cents INTEGER, _method public.payment_method,
  _reference TEXT DEFAULT NULL, _paid_at TIMESTAMPTZ DEFAULT now(), _notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inv RECORD; _pid UUID; _paid INTEGER; _due INTEGER; _new_status public.invoice_status;
BEGIN
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id FOR UPDATE;
  IF _inv IS NULL THEN RAISE EXCEPTION 'invoice not found'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _inv.shop_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _inv.status = 'draft' THEN RAISE EXCEPTION 'cannot pay a draft invoice'; END IF;
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;

  INSERT INTO public.payments(shop_id, customer_id, invoice_id, repair_id, amount_cents, currency,
    method, status, reference, paid_at, notes, recorded_by)
  VALUES (_inv.shop_id, _inv.customer_id, _inv.id, _inv.repair_id, _amount_cents, _inv.currency,
    _method, 'confirmed', _reference, _paid_at, _notes, auth.uid())
  RETURNING id INTO _pid;

  _paid := _inv.amount_paid_cents + _amount_cents;
  _due := GREATEST(_inv.total_including_tax_cents - _paid, 0);
  _new_status := CASE
    WHEN _paid >= _inv.total_including_tax_cents THEN 'paid'::public.invoice_status
    WHEN _paid > 0 THEN 'partially_paid'::public.invoice_status
    ELSE _inv.status
  END;
  UPDATE public.invoices SET
    amount_paid_cents = _paid,
    amount_due_cents = _due,
    status = _new_status,
    paid_at = CASE WHEN _due = 0 THEN now() ELSE paid_at END
  WHERE id = _inv.id;
  RETURN _pid;
END; $$;
REVOKE ALL ON FUNCTION public.record_payment(UUID, INTEGER, public.payment_method, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment(UUID, INTEGER, public.payment_method, TEXT, TIMESTAMPTZ, TEXT) TO authenticated;

-- Émettre un avoir
CREATE OR REPLACE FUNCTION public.issue_credit_note(_credit_note_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _shop UUID; _num TEXT; _status public.invoice_status; _inv UUID; _tot INTEGER; _inv_tot INTEGER;
BEGIN
  SELECT shop_id, status, invoice_id, total_including_tax_cents
    INTO _shop, _status, _inv, _tot
    FROM public.credit_notes WHERE id = _credit_note_id FOR UPDATE;
  IF _shop IS NULL THEN RAISE EXCEPTION 'credit note not found'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'credit note already issued'; END IF;

  _num := public.generate_document_number(_shop, 'credit_note');
  UPDATE public.credit_notes SET
    credit_note_number = _num,
    status = 'issued',
    issue_date = COALESCE(issue_date, current_date),
    issued_at = now(),
    locked_at = now()
  WHERE id = _credit_note_id;

  -- Mettre à jour la facture si l'avoir couvre tout
  SELECT total_including_tax_cents INTO _inv_tot FROM public.invoices WHERE id = _inv;
  IF _tot >= _inv_tot THEN
    UPDATE public.invoices SET status = 'cancelled_by_credit_note' WHERE id = _inv;
  END IF;
  RETURN _num;
END; $$;
REVOKE ALL ON FUNCTION public.issue_credit_note(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_credit_note(UUID) TO authenticated;

-- Acceptation via jeton public (SECURITY DEFINER — pas de auth requise)
CREATE OR REPLACE FUNCTION public.public_get_quote(_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tok RECORD; _q RECORD;
BEGIN
  SELECT * INTO _tok FROM public.quote_public_tokens WHERE token = _token;
  IF _tok IS NULL THEN RETURN NULL; END IF;
  IF _tok.revoked_at IS NOT NULL THEN RETURN NULL; END IF;
  IF _tok.expires_at IS NOT NULL AND _tok.expires_at < now() THEN RETURN NULL; END IF;

  UPDATE public.quote_public_tokens
    SET view_count = view_count + 1,
        first_viewed_at = COALESCE(first_viewed_at, now()),
        last_viewed_at = now()
    WHERE id = _tok.id;
  UPDATE public.quotes SET viewed_at = COALESCE(viewed_at, now()),
    status = CASE WHEN status = 'sent' THEN 'viewed'::public.quote_status ELSE status END
    WHERE id = _tok.quote_id;

  SELECT id, quote_number, status, issue_date, valid_until, currency,
    subtotal_excluding_tax_cents, tax_total_cents, total_including_tax_cents,
    deposit_requested_cents, customer_message, terms_snapshot,
    billing_identity_snapshot, customer_identity_snapshot,
    accepted_at, refused_at, locked_at
    INTO _q FROM public.quotes WHERE id = _tok.quote_id;

  RETURN jsonb_build_object(
    'quote', to_jsonb(_q),
    'lines', COALESCE((SELECT jsonb_agg(to_jsonb(ql) ORDER BY ql.display_order)
      FROM public.quote_lines ql WHERE ql.quote_id = _tok.quote_id), '[]'::jsonb)
  );
END; $$;
REVOKE ALL ON FUNCTION public.public_get_quote(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_get_quote(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_accept_quote(
  _token TEXT, _name TEXT, _signature TEXT DEFAULT NULL, _ip TEXT DEFAULT NULL, _ua TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _tok RECORD; _q RECORD;
BEGIN
  SELECT * INTO _tok FROM public.quote_public_tokens WHERE token = _token;
  IF _tok IS NULL OR _tok.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invalid token'; END IF;
  IF _tok.expires_at IS NOT NULL AND _tok.expires_at < now() THEN RAISE EXCEPTION 'expired'; END IF;

  SELECT * INTO _q FROM public.quotes WHERE id = _tok.quote_id FOR UPDATE;
  IF _q.status NOT IN ('sent','viewed') THEN RAISE EXCEPTION 'quote cannot be accepted'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'signer name required'; END IF;

  UPDATE public.quotes SET
    status = 'accepted',
    accepted_at = now(),
    accepted_by_name = _name,
    accepted_ip = _ip,
    accepted_user_agent = _ua,
    locked_at = now(),
    document_hash = md5(coalesce(_q.customer_message,'') || _q.total_including_tax_cents::text || _q.id::text)
  WHERE id = _q.id;

  IF _q.repair_id IS NOT NULL THEN
    UPDATE public.repairs SET status = 'quote_accepted'::public.repair_status
      WHERE id = _q.repair_id AND status IN ('quote_sent','awaiting_response','quote_to_prepare');
  END IF;

  -- Stocker signature dans notes internes du jeton (audit léger)
  IF _signature IS NOT NULL THEN
    UPDATE public.quote_public_tokens SET last_viewed_at = now() WHERE id = _tok.id;
  END IF;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.public_accept_quote(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_accept_quote(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.public_refuse_quote(_token TEXT, _reason TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tok RECORD; _q RECORD;
BEGIN
  SELECT * INTO _tok FROM public.quote_public_tokens WHERE token = _token;
  IF _tok IS NULL OR _tok.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invalid token'; END IF;
  SELECT * INTO _q FROM public.quotes WHERE id = _tok.quote_id FOR UPDATE;
  IF _q.status NOT IN ('sent','viewed') THEN RAISE EXCEPTION 'quote cannot be refused'; END IF;
  UPDATE public.quotes SET status = 'refused', refused_at = now(), refusal_reason = _reason
    WHERE id = _q.id;
  IF _q.repair_id IS NOT NULL THEN
    UPDATE public.repairs SET status = 'quote_rejected'::public.repair_status
      WHERE id = _q.repair_id AND status IN ('quote_sent','awaiting_response');
  END IF;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.public_refuse_quote(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_refuse_quote(TEXT, TEXT) TO anon, authenticated;