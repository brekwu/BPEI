// Server-only helpers for the Stripe Terminal module. Never import from client code.
import Stripe from "stripe";
import { getStripe, stripeEnvironment } from "@/lib/stripe.server";

export { getStripe, stripeEnvironment };

export type TerminalFlagStatus = "blocked" | "test_only" | "ready_for_live_review" | "live";

/**
 * Resolves the Stripe connected account for a shop. Uses the admin client so
 * the caller MUST have verified the caller can act on that shop before
 * calling this helper.
 */
export async function resolveShopStripeAccount(shopId: string): Promise<{
  accountId: string;
  chargesEnabled: boolean;
  livemode: boolean;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("shops")
    .select("stripe_account_id, stripe_charges_enabled, stripe_environment")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.stripe_account_id) throw new Error("Boutique sans compte Stripe connecté");
  if (!data.stripe_charges_enabled) throw new Error("Compte Stripe : encaissement carte non activé");
  return {
    accountId: data.stripe_account_id,
    chargesEnabled: !!data.stripe_charges_enabled,
    livemode: data.stripe_environment === "live",
  };
}

export async function readTerminalFlag(): Promise<TerminalFlagStatus> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "terminal_payments")
    .maybeSingle();
  const s = (data?.value as any)?.status as TerminalFlagStatus | undefined;
  return s ?? "blocked";
}

export function assertFlagAllows(status: TerminalFlagStatus, wantLive: boolean) {
  if (status === "blocked") throw new Error("Module TPE désactivé par la plateforme");
  if (wantLive && status !== "live") throw new Error("Mode LIVE non autorisé : le module est en test");
}

/**
 * Verify the authenticated caller is a shop manager or owner. Uses the
 * user-scoped supabase client so RLS applies.
 */
export async function assertShopManager(supabase: any, userId: string, shopId: string) {
  const { data: platformRoles } = await supabase
    .from("user_platform_roles").select("role").eq("user_id", userId);
  const isAdmin = (platformRoles ?? []).some(
    (r: any) => r.role === "admin_bpei" || r.role === "owner_bpei",
  );
  if (isAdmin) return { role: "admin_bpei" as const };

  const { data: mem } = await supabase
    .from("shop_memberships")
    .select("role")
    .eq("shop_id", shopId).eq("user_id", userId)
    .maybeSingle();
  if (!mem || !["shop_manager", "network_owner"].includes(mem.role)) {
    throw new Error("Accès refusé : rôle gérant requis pour ce module");
  }
  return { role: mem.role as string };
}

export function stripeOptsFor(accountId: string): Stripe.RequestOptions {
  return { stripeAccount: accountId };
}

/** Sanitized metadata for PaymentIntents: never include PII or notes. */
export function safeMetadata(input: Record<string, string | number | null | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined) continue;
    const s = String(v);
    if (s.length > 400) continue;
    out[k] = s;
  }
  return out;
}