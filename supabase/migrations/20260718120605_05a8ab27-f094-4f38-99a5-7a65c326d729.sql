INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('terminal_payments', jsonb_build_object('status','test_only','updated_at', now()), now())
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.terminal_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  stripe_location_id text NOT NULL,
  stripe_account_id text NOT NULL,
  name text NOT NULL,
  address jsonb,
  livemode boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, stripe_location_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminal_locations TO authenticated;
GRANT ALL ON public.terminal_locations TO service_role;
ALTER TABLE public.terminal_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read locations" ON public.terminal_locations
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "shop managers write locations" ON public.terminal_locations
  FOR ALL TO authenticated
  USING (
    public.is_shop_member(auth.uid(), shop_id) AND EXISTS (
      SELECT 1 FROM public.shop_memberships m
      WHERE m.shop_id = terminal_locations.shop_id
        AND m.user_id = auth.uid()
        AND m.role IN ('shop_manager','network_owner')
    )
  )
  WITH CHECK (
    public.is_shop_member(auth.uid(), shop_id) AND EXISTS (
      SELECT 1 FROM public.shop_memberships m
      WHERE m.shop_id = terminal_locations.shop_id
        AND m.user_id = auth.uid()
        AND m.role IN ('shop_manager','network_owner')
    )
  );
CREATE INDEX IF NOT EXISTS terminal_locations_shop_idx ON public.terminal_locations(shop_id);

CREATE TABLE IF NOT EXISTS public.terminal_readers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.terminal_locations(id) ON DELETE SET NULL,
  stripe_account_id text NOT NULL,
  stripe_reader_id text NOT NULL,
  stripe_location_id text,
  label text NOT NULL,
  serial_number text,
  device_type text,
  status text,
  last_seen_at timestamptz,
  livemode boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  is_simulated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, stripe_reader_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminal_readers TO authenticated;
GRANT ALL ON public.terminal_readers TO service_role;
ALTER TABLE public.terminal_readers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read readers" ON public.terminal_readers
  FOR SELECT TO authenticated USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "shop managers write readers" ON public.terminal_readers
  FOR ALL TO authenticated
  USING (
    public.is_shop_member(auth.uid(), shop_id) AND EXISTS (
      SELECT 1 FROM public.shop_memberships m
      WHERE m.shop_id = terminal_readers.shop_id
        AND m.user_id = auth.uid()
        AND m.role IN ('shop_manager','network_owner')
    )
  )
  WITH CHECK (
    public.is_shop_member(auth.uid(), shop_id) AND EXISTS (
      SELECT 1 FROM public.shop_memberships m
      WHERE m.shop_id = terminal_readers.shop_id
        AND m.user_id = auth.uid()
        AND m.role IN ('shop_manager','network_owner')
    )
  );
CREATE INDEX IF NOT EXISTS terminal_readers_shop_idx ON public.terminal_readers(shop_id);
CREATE UNIQUE INDEX IF NOT EXISTS terminal_readers_default_uidx
  ON public.terminal_readers(shop_id, livemode) WHERE is_default = true;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_id text,
  ADD COLUMN IF NOT EXISTS stripe_reader_id text,
  ADD COLUMN IF NOT EXISTS livemode boolean,
  ADD COLUMN IF NOT EXISTS local_state text,
  ADD COLUMN IF NOT EXISTS card_brand text,
  ADD COLUMN IF NOT EXISTS terminal_last_error text,
  ADD COLUMN IF NOT EXISTS terminal_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS terminal_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS payments_stripe_pi_lookup_idx
  ON public.payments(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_line_id uuid REFERENCES public.sale_lines(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_terminal_uidx
  ON public.stock_movements(payment_id, sale_line_id)
  WHERE payment_id IS NOT NULL AND sale_line_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_terminal_locations_updated ON public.terminal_locations;
CREATE TRIGGER trg_terminal_locations_updated BEFORE UPDATE ON public.terminal_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_terminal_readers_updated ON public.terminal_readers;
CREATE TRIGGER trg_terminal_readers_updated BEFORE UPDATE ON public.terminal_readers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.payments_terminal_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.provider = 'stripe' AND OLD.status = 'confirmed' THEN
    IF NEW.amount_cents <> OLD.amount_cents
       OR NEW.currency <> OLD.currency
       OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
       OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
    THEN
      RAISE EXCEPTION 'Paiement TPE confirmé : montant/PaymentIntent/compte non modifiables';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_payments_terminal_immutable ON public.payments;
CREATE TRIGGER trg_payments_terminal_immutable BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_terminal_immutable();

CREATE OR REPLACE FUNCTION public.terminal_flag_status()
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE((SELECT value->>'status' FROM public.app_settings WHERE key='terminal_payments'), 'blocked');
$$;
GRANT EXECUTE ON FUNCTION public.terminal_flag_status() TO authenticated, anon;