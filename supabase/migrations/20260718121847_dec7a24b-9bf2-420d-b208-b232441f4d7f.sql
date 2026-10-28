ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_refund_id text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_refund_unique_idx
  ON public.payments (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;