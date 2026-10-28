import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ensure the caller can manage Stripe onboarding for the given shop.
 * Uses the authenticated user's supabase client (RLS applies).
 */
async function assertShopManager(supabase: any, userId: string, shopId: string) {
  // Require an elevated role: shop_manager, network_owner, or admin_bpei/owner_bpei.
  const { data: platformRoles } = await supabase
    .from("user_platform_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (platformRoles ?? []).some(
    (r: any) => r.role === "admin_bpei" || r.role === "owner_bpei",
  );

  if (!isAdmin) {
    const { data: mem } = await supabase
      .from("shop_memberships")
      .select("role")
      .eq("shop_id", shopId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!mem || !["shop_manager", "network_owner"].includes(mem.role)) {
      throw new Error("Accès refusé : rôle gérant requis pour Stripe.");
    }
  }

  const { data: shop, error } = await supabase
    .from("shops")
    .select("id, owner_user_id, name, country, business_type, contact_email")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!shop) throw new Error("Boutique introuvable ou accès refusé");
  return shop as {
    id: string; owner_user_id: string | null; name: string;
    country: string | null; business_type: string | null; contact_email: string | null;
  };
}

/** Fetch current Stripe status for a shop from our DB (no Stripe call). */
export const getShopStripeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("shops")
      .select("id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted, stripe_onboarding_status, stripe_requirements, stripe_environment, stripe_platform_fee_bps, stripe_synced_at")
      .eq("id", data.shopId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Boutique introuvable");
    return row;
  });

/**
 * Create a Stripe Express account for the shop if none exists, then return
 * an Account Link the shop owner opens to complete onboarding.
 */
export const startStripeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; returnUrl: string; refreshUrl: string }) =>
    z.object({
      shopId: z.string().uuid(),
      returnUrl: z.string().url(),
      refreshUrl: z.string().url(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const shop = await assertShopManager(context.supabase, context.userId, data.shopId);
    const { getStripe, stripeEnvironment, classifyAccount } = await import("@/lib/stripe.server");
    const stripe = getStripe();
    const env = stripeEnvironment();

    // Fetch admin client to bypass RLS for writing the stripe_account_id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get existing account id if any
    const { data: existing } = await supabaseAdmin
      .from("shops")
      .select("stripe_account_id, stripe_environment")
      .eq("id", data.shopId)
      .maybeSingle();

    let accountId = existing?.stripe_account_id ?? null;

    // If environment changed (test ↔ live), reset
    if (accountId && existing?.stripe_environment && existing.stripe_environment !== env) {
      accountId = null;
    }

    if (!accountId) {
      const country = (shop.country ?? "FR").toUpperCase();
      const account = await stripe.accounts.create({
        type: "express",
        country,
        email: shop.contact_email ?? undefined,
        business_type: shop.business_type === "independant_mobile" ? "individual" : "company",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          bpei_shop_id: shop.id,
          bpei_shop_name: shop.name,
        },
      });
      accountId = account.id;

      await supabaseAdmin
        .from("shops")
        .update({
          stripe_account_id: accountId,
          stripe_environment: env,
          stripe_onboarding_status: "pending",
          stripe_synced_at: new Date().toISOString(),
        })
        .eq("id", shop.id);
    }

    // Create an account link
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: data.refreshUrl,
      return_url: data.returnUrl,
      type: "account_onboarding",
    });

    // Also sync current status in one go
    try {
      const acc = await stripe.accounts.retrieve(accountId);
      const st = classifyAccount(acc);
      await supabaseAdmin
        .from("shops")
        .update({
          stripe_charges_enabled: st.chargesEnabled,
          stripe_payouts_enabled: st.payoutsEnabled,
          stripe_details_submitted: st.detailsSubmitted,
          stripe_onboarding_status: st.onboarding,
          stripe_requirements: st.requirements as any,
          stripe_synced_at: new Date().toISOString(),
        })
        .eq("id", shop.id);
    } catch {/* ignore sync errors, link is still valid */}

    return { url: link.url, expiresAt: link.expires_at, accountId };
  });

/** Force a refresh of the shop's Stripe account status from Stripe. */
export const refreshStripeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertShopManager(context.supabase, context.userId, data.shopId);
    const { getStripe, classifyAccount } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("shops")
      .select("stripe_account_id")
      .eq("id", data.shopId)
      .maybeSingle();
    if (!row?.stripe_account_id) throw new Error("Aucun compte Stripe rattaché");

    const stripe = getStripe();
    const acc = await stripe.accounts.retrieve(row.stripe_account_id);
    const st = classifyAccount(acc);
    await supabaseAdmin
      .from("shops")
      .update({
        stripe_charges_enabled: st.chargesEnabled,
        stripe_payouts_enabled: st.payoutsEnabled,
        stripe_details_submitted: st.detailsSubmitted,
        stripe_onboarding_status: st.onboarding,
        stripe_requirements: st.requirements as any,
        stripe_synced_at: new Date().toISOString(),
      })
      .eq("id", data.shopId);
    return st;
  });

/** Generate an Express Dashboard login link for the shop owner. */
export const createStripeLoginLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertShopManager(context.supabase, context.userId, data.shopId);
    const { getStripe } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("shops")
      .select("stripe_account_id, stripe_details_submitted")
      .eq("id", data.shopId).maybeSingle();
    if (!row?.stripe_account_id) throw new Error("Aucun compte Stripe rattaché");
    if (!row.stripe_details_submitted) throw new Error("L'onboarding n'est pas terminé");
    const stripe = getStripe();
    const link = await stripe.accounts.createLoginLink(row.stripe_account_id);
    return { url: link.url };
  });