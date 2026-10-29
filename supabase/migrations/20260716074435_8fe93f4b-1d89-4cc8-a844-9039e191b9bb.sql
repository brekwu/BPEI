ALTER TABLE public.shop_billing_settings
  ADD COLUMN IF NOT EXISTS accepts_card_in_store boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_cash boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_payment_on_pickup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_bank_transfer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_cheque boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepts_manual_payment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_transfer_instructions text,
  ADD COLUMN IF NOT EXISTS payment_preparation_delay text,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Public function returning only non-sensitive payment method info
CREATE OR REPLACE FUNCTION public.public_get_shop_payment_methods(_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _s RECORD;
BEGIN
  -- Only for validated shops
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND status = 'validated') THEN
    RETURN NULL;
  END IF;
  SELECT accepts_card_in_store, accepts_cash, accepts_payment_on_pickup,
         accepts_bank_transfer, accepts_cheque, accepts_manual_payment,
         payment_preparation_delay
    INTO _s FROM public.shop_billing_settings WHERE shop_id = _shop_id;
  IF _s IS NULL THEN
    RETURN jsonb_build_object(
      'accepts_card_in_store', false, 'accepts_cash', false,
      'accepts_payment_on_pickup', false, 'accepts_bank_transfer', false,
      'accepts_cheque', false, 'accepts_manual_payment', false,
      'payment_preparation_delay', null
    );
  END IF;
  RETURN jsonb_build_object(
    'accepts_card_in_store', _s.accepts_card_in_store,
    'accepts_cash', _s.accepts_cash,
    'accepts_payment_on_pickup', _s.accepts_payment_on_pickup,
    'accepts_bank_transfer', _s.accepts_bank_transfer,
    'accepts_cheque', _s.accepts_cheque,
    'accepts_manual_payment', _s.accepts_manual_payment,
    'payment_preparation_delay', _s.payment_preparation_delay
  );
END $$;

GRANT EXECUTE ON FUNCTION public.public_get_shop_payment_methods(uuid) TO anon, authenticated;