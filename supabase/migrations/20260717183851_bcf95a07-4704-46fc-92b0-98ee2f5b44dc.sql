ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER,
  ADD COLUMN IF NOT EXISTS refunded_amount_cents INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_pi_unique_idx
  ON public.payments (shop_id, provider_reference)
  WHERE provider = 'stripe' AND provider_reference IS NOT NULL;

DROP FUNCTION IF EXISTS public.get_payment_link_public(TEXT);

CREATE OR REPLACE FUNCTION public.get_payment_link_public(_token TEXT)
RETURNS TABLE(
  id UUID,
  status TEXT,
  amount_cents INTEGER,
  currency TEXT,
  label TEXT,
  bank_reference TEXT,
  expires_at TIMESTAMPTZ,
  accepted_methods TEXT[],
  shop_id UUID,
  shop_name TEXT,
  shop_iban TEXT,
  shop_bic TEXT,
  shop_holder TEXT,
  shop_transfer_instructions TEXT,
  shop_stripe_ready BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT pl.id, pl.status, pl.amount_cents, pl.currency, pl.label, pl.bank_reference,
         pl.expires_at, pl.accepted_methods,
         s.id, s.name,
         sbs.iban, sbs.bic, sbs.bank_account_holder, sbs.bank_transfer_instructions,
         (COALESCE(s.stripe_charges_enabled, false) AND s.stripe_account_id IS NOT NULL)
  FROM public.payment_links pl
  JOIN public.shops s ON s.id = pl.shop_id
  LEFT JOIN public.shop_billing_settings sbs ON sbs.shop_id = pl.shop_id
  WHERE pl.token = _token
  LIMIT 1;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_payment_link_public(TEXT) TO anon, authenticated;