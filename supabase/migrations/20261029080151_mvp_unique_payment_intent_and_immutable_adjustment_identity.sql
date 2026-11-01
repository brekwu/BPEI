-- A signed Stripe Connect adjustment must resolve to exactly one payment on one merchant.
CREATE UNIQUE INDEX bpei_payment_attempts_unique_merchant_intent
 ON public.bpei_payment_attempts(connected_account_id,stripe_payment_intent_id)
 WHERE stripe_payment_intent_id IS NOT NULL;
-- Preserve the issuer/payment identity if a refund/dispute object is updated.
CREATE OR REPLACE FUNCTION bpei_private.prevent_adjustment_reassignment()
 RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.attempt_id IS DISTINCT FROM OLD.attempt_id THEN
   RAISE EXCEPTION 'Provider adjustment cannot be reassigned to a different invoice'
    USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='bpei_payment_refunds' THEN
  IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
    OR NEW.stripe_refund_id IS DISTINCT FROM OLD.stripe_refund_id THEN
   RAISE EXCEPTION 'Refund identity and amount are immutable' USING ERRCODE='42501';
  END IF;
 ELSE
  IF NEW.disputed_cents IS DISTINCT FROM OLD.disputed_cents
    OR NEW.stripe_dispute_id IS DISTINCT FROM OLD.stripe_dispute_id THEN
   RAISE EXCEPTION 'Dispute identity and amount are immutable' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bpei_private.prevent_adjustment_reassignment()
 FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_prevent_refund_reassignment
 BEFORE UPDATE ON public.bpei_payment_refunds
 FOR EACH ROW EXECUTE FUNCTION bpei_private.prevent_adjustment_reassignment();
CREATE TRIGGER bpei_prevent_dispute_reassignment
 BEFORE UPDATE ON public.bpei_payment_disputes
 FOR EACH ROW EXECUTE FUNCTION bpei_private.prevent_adjustment_reassignment();
