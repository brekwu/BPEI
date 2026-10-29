-- 1) Étendre payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS provider_reference TEXT;
CREATE INDEX IF NOT EXISTS payments_shop_provider_status_idx
  ON public.payments (shop_id, provider, status);

-- 2) Table payment_links
CREATE TABLE public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  label TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  expires_at TIMESTAMPTZ,
  paid_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  bank_reference TEXT NOT NULL,
  accepted_methods TEXT[] NOT NULL DEFAULT ARRAY['bank_transfer']::TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_links_shop_status_idx ON public.payment_links (shop_id, status, created_at DESC);
CREATE INDEX payment_links_token_idx ON public.payment_links (token);

-- 3) GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO authenticated;
GRANT ALL ON public.payment_links TO service_role;

-- 4) RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members read payment_links" ON public.payment_links
  FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "Shop members insert payment_links" ON public.payment_links
  FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "Shop members update payment_links" ON public.payment_links
  FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "Shop members delete payment_links" ON public.payment_links
  FOR DELETE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));

-- 5) updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_payment_links_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_payment_links_touch
BEFORE UPDATE ON public.payment_links
FOR EACH ROW EXECUTE FUNCTION public.tg_payment_links_touch();

-- 6) RPC create_payment_link
CREATE OR REPLACE FUNCTION public.create_payment_link(
  _shop_id UUID,
  _amount_cents INTEGER,
  _invoice_id UUID DEFAULT NULL,
  _repair_id UUID DEFAULT NULL,
  _sale_id UUID DEFAULT NULL,
  _customer_id UUID DEFAULT NULL,
  _label TEXT DEFAULT NULL,
  _expires_days INTEGER DEFAULT 30,
  _accepted_methods TEXT[] DEFAULT ARRAY['bank_transfer']::TEXT[]
) RETURNS TABLE(id UUID, token TEXT, bank_reference TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  new_id UUID;
  new_token TEXT;
  new_ref TEXT;
  suffix TEXT;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _shop_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  new_token := replace(replace(replace(encode(extensions.gen_random_bytes(24),'base64'),'+','-'),'/','_'),'=','');
  suffix := upper(substr(md5(gen_random_uuid()::text), 1, 4));
  new_ref := 'BPEI-'||to_char(now(),'YYYYMM')||'-'||suffix;

  INSERT INTO public.payment_links (
    shop_id, token, invoice_id, repair_id, sale_id, customer_id,
    amount_cents, label, expires_at, bank_reference, accepted_methods, created_by
  ) VALUES (
    _shop_id, new_token, _invoice_id, _repair_id, _sale_id, _customer_id,
    _amount_cents, _label,
    CASE WHEN _expires_days IS NULL THEN NULL ELSE now() + make_interval(days => _expires_days) END,
    new_ref, COALESCE(_accepted_methods, ARRAY['bank_transfer']::TEXT[]), auth.uid()
  ) RETURNING payment_links.id INTO new_id;

  RETURN QUERY SELECT new_id, new_token, new_ref;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_payment_link(UUID, INTEGER, UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT[]) TO authenticated;

-- 7) RPC cancel_payment_link
CREATE OR REPLACE FUNCTION public.cancel_payment_link(_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop UUID;
BEGIN
  SELECT shop_id INTO _shop FROM public.payment_links WHERE id = _id;
  IF _shop IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE public.payment_links
  SET status = 'cancelled'
  WHERE id = _id AND status = 'pending';
END; $$;

GRANT EXECUTE ON FUNCTION public.cancel_payment_link(UUID) TO authenticated;

-- 8) RPC record_bank_transfer
CREATE OR REPLACE FUNCTION public.record_bank_transfer(
  _shop_id UUID,
  _amount_cents INTEGER,
  _reference TEXT,
  _paid_at TIMESTAMPTZ DEFAULT now(),
  _invoice_id UUID DEFAULT NULL,
  _customer_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL,
  _payment_link_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_payment_id UUID;
  inv_total INTEGER;
  inv_paid INTEGER;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _shop_id) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  INSERT INTO public.payments (
    shop_id, invoice_id, customer_id, amount_cents, currency, method, status,
    reference, paid_at, notes, recorded_by, connector_type, provider
  ) VALUES (
    _shop_id, _invoice_id, _customer_id, _amount_cents, 'EUR', 'bank_transfer', 'confirmed',
    _reference, COALESCE(_paid_at, now()), _notes, auth.uid(), 'manual', 'bank_transfer'
  ) RETURNING id INTO new_payment_id;

  IF _invoice_id IS NOT NULL THEN
    SELECT total_including_tax_cents, COALESCE(amount_paid_cents,0)
      INTO inv_total, inv_paid
    FROM public.invoices WHERE id = _invoice_id AND shop_id = _shop_id;
    IF inv_total IS NOT NULL THEN
      UPDATE public.invoices
      SET amount_paid_cents = inv_paid + _amount_cents,
          amount_due_cents  = GREATEST(inv_total - (inv_paid + _amount_cents), 0),
          status = CASE WHEN (inv_paid + _amount_cents) >= inv_total THEN 'paid' ELSE status END,
          paid_at = CASE WHEN (inv_paid + _amount_cents) >= inv_total THEN COALESCE(_paid_at, now()) ELSE paid_at END
      WHERE id = _invoice_id;
    END IF;
  END IF;

  IF _payment_link_id IS NOT NULL THEN
    UPDATE public.payment_links
    SET status = 'paid', paid_payment_id = new_payment_id, paid_at = COALESCE(_paid_at, now())
    WHERE id = _payment_link_id AND shop_id = _shop_id AND status = 'pending';
  END IF;

  RETURN new_payment_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.record_bank_transfer(UUID, INTEGER, TEXT, TIMESTAMPTZ, UUID, UUID, TEXT, UUID) TO authenticated;