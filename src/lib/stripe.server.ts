// Server-only Stripe platform client. Never import from client code.
import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Returns the BPEI platform Stripe client. Uses STRIPE_SECRET_KEY (test or live).
 * Throws a readable error if the secret is missing so calling server fns can
 * report the misconfiguration without leaking internals.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant côté serveur");
  cached = new Stripe(key, {
    apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
    typescript: true,
    appInfo: { name: "BPEI Platform", version: "1.0.0" },
  });
  return cached;
}

export function stripeEnvironment(): "test" | "live" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_live_") ? "live" : "test";
}

export type StripeAccountStatus = {
  onboarding: "not_started" | "pending" | "restricted" | "active" | "rejected" | "disabled";
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: Stripe.Account.Requirements | null;
};

export function classifyAccount(a: Stripe.Account): StripeAccountStatus {
  const req = a.requirements ?? null;
  const disabledReason = req?.disabled_reason ?? null;
  let onboarding: StripeAccountStatus["onboarding"] = "pending";
  if (disabledReason === "rejected.fraud" || disabledReason === "rejected.terms_of_service" || disabledReason === "rejected.listed" || disabledReason === "rejected.other") {
    onboarding = "rejected";
  } else if (a.charges_enabled && a.details_submitted) {
    onboarding = "active";
  } else if (disabledReason && disabledReason !== "requirements.past_due" && disabledReason !== "requirements.pending_verification") {
    onboarding = "disabled";
  } else if (req && (req.currently_due?.length ?? 0) > 0 && a.details_submitted) {
    onboarding = "restricted";
  } else if (!a.details_submitted) {
    onboarding = "pending";
  }
  return {
    onboarding,
    chargesEnabled: !!a.charges_enabled,
    payoutsEnabled: !!a.payouts_enabled,
    detailsSubmitted: !!a.details_submitted,
    requirements: req,
  };
}