-- 1. Extend shops table
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS stripe_account_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_status text NOT NULL DEFAULT 'not_started'
    CHECK (stripe_onboarding_status IN ('not_started','pending','restricted','active','rejected','disabled')),
  ADD COLUMN IF NOT EXISTS stripe_requirements jsonb,
  ADD COLUMN IF NOT EXISTS stripe_environment text NOT NULL DEFAULT 'test'
    CHECK (stripe_environment IN ('test','live')),
  ADD COLUMN IF NOT EXISTS stripe_platform_fee_bps integer NOT NULL DEFAULT 0
    CHECK (stripe_platform_fee_bps BETWEEN 0 AND 2000),
  ADD COLUMN IF NOT EXISTS stripe_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS shops_stripe_account_id_idx ON public.shops (stripe_account_id);

-- 2. Stripe events (webhook idempotency + audit)
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  account_id text,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  livemode boolean NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_events_event_type_idx ON public.stripe_events (event_type);
CREATE INDEX IF NOT EXISTS stripe_events_account_id_idx ON public.stripe_events (account_id);
CREATE INDEX IF NOT EXISTS stripe_events_received_at_idx ON public.stripe_events (received_at DESC);

GRANT SELECT ON public.stripe_events TO authenticated;
GRANT ALL ON public.stripe_events TO service_role;

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view stripe events"
  ON public.stripe_events FOR SELECT
  TO authenticated
  USING (public.is_owner_bpei(auth.uid()));

-- 3. Helper: is a shop Stripe-ready?
CREATE OR REPLACE FUNCTION public.shop_stripe_ready(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = _shop_id
      AND stripe_account_id IS NOT NULL
      AND stripe_charges_enabled = true
      AND stripe_onboarding_status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.shop_stripe_ready(uuid) TO authenticated, service_role;