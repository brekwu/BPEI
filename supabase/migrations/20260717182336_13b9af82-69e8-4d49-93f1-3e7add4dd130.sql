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
  shop_transfer_instructions TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT pl.id, pl.status, pl.amount_cents, pl.currency, pl.label, pl.bank_reference,
         pl.expires_at, pl.accepted_methods,
         s.id, s.name,
         sbs.iban, sbs.bic, sbs.bank_account_holder, sbs.bank_transfer_instructions
  FROM public.payment_links pl
  JOIN public.shops s ON s.id = pl.shop_id
  LEFT JOIN public.shop_billing_settings sbs ON sbs.shop_id = pl.shop_id
  WHERE pl.token = _token
  LIMIT 1;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_payment_link_public(TEXT) TO anon, authenticated;