-- Explicit zero-access policies document internal-only payment configuration and event ledger.
-- Even authenticated roles with accidental future GRANTs cannot select these rows.
CREATE POLICY bpei_payment_controls_denied_to_users ON public.bpei_payment_controls
 FOR SELECT TO anon,authenticated USING(false);
CREATE POLICY bpei_stripe_accounts_denied_to_users ON public.bpei_stripe_connected_accounts
 FOR SELECT TO anon,authenticated USING(false);
CREATE POLICY bpei_payment_events_denied_to_users ON public.bpei_payment_webhook_events
 FOR SELECT TO anon,authenticated USING(false);
