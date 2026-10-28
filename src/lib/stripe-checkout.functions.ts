import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Stripe Checkout flows for BPEI shops (Session 2).
 *
 * Model: Direct charges on the connected account (`stripeAccount` option).
 * Funds land on the shop's Stripe balance; the platform collects a fee via
 * `application_fee_amount`. Webhooks handle post-payment reconciliation on the
 * `/api/public/stripe/connect` endpoint (Connect webhook).
 */

type ShopStripeRow = {
  id: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_platform_fee_bps: number | null;
  currency?: string;
};

async function loadShopReadyForCharges(supabase: any, shopId: string): Promise<ShopStripeRow> {
  const { data, error } = await supabase
    .from("shops")
    .select("id, stripe_account_id, stripe_charges_enabled, stripe_platform_fee_bps")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Boutique introuvable");
  if (!data.stripe_account_id || !data.stripe_charges_enabled) {
    throw new Error("La boutique n'a pas encore activé les paiements par carte Stripe.");
  }
  return data as ShopStripeRow;
}

function feeCents(amountCents: number, bps: number | null): number {
  const b = Math.max(0, Math.min(bps ?? 0, 5000)); // safety cap 50%
  return Math.floor((amountCents * b) / 10000);
}

/** Authenticated: create a Checkout Session to pay an invoice by card. */
export const createInvoiceCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; invoiceId: string; successUrl: string; cancelUrl: string }) =>
    z.object({
      shopId: z.string().uuid(),
      invoiceId: z.string().uuid(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const shop = await loadShopReadyForCharges(context.supabase, data.shopId);

    const { data: inv, error } = await context.supabase
      .from("invoices")
      .select("id, invoice_number, status, currency, amount_due_cents, customer_id, customers:customer_id(email, first_name, last_name, company_name)")
      .eq("id", data.invoiceId)
      .eq("shop_id", data.shopId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Facture introuvable");
    if (inv.status === "draft") throw new Error("Émettez la facture avant d'encaisser.");
    if ((inv.amount_due_cents ?? 0) <= 0) throw new Error("Cette facture est déjà réglée.");

    const { getStripe } = await import("@/lib/stripe.server");
    const stripe = getStripe();
    const amount = inv.amount_due_cents as number;
    const currency = (inv.currency ?? "EUR").toLowerCase();
    const fee = feeCents(amount, shop.stripe_platform_fee_bps);
    const customer = Array.isArray(inv.customers) ? inv.customers[0] : (inv.customers as any);
    const customerEmail: string | undefined = customer?.email ?? undefined;
    const customerName: string | undefined = customer
      ? (customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || undefined)
      : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      customer_email: customerEmail,
      client_reference_id: inv.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amount,
          product_data: {
            name: `Facture ${inv.invoice_number ?? ""}`.trim(),
            description: customerName ? `Payeur : ${customerName}` : undefined,
          },
        },
      }],
      payment_intent_data: {
        application_fee_amount: fee || undefined,
        metadata: {
          bpei_kind: "invoice",
          bpei_shop_id: data.shopId,
          bpei_invoice_id: inv.id,
        },
      },
      metadata: {
        bpei_kind: "invoice",
        bpei_shop_id: data.shopId,
        bpei_invoice_id: inv.id,
      },
    }, { stripeAccount: shop.stripe_account_id! });

    return { url: session.url!, sessionId: session.id };
  });

/** Public: create a Checkout Session for a payment link (no auth, token is capability). */
export const createPaymentLinkCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string; successUrl: string; cancelUrl: string }) =>
    z.object({
      token: z.string().min(10).max(128),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin
      .from("payment_links")
      .select("id, shop_id, status, amount_cents, currency, label, invoice_id, customer_id, accepted_methods, bank_reference")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!link) throw new Error("Lien introuvable");
    if (link.status !== "pending") throw new Error("Ce lien n'est plus payable.");

    const shop = await loadShopReadyForCharges(supabaseAdmin, link.shop_id);
    const { getStripe } = await import("@/lib/stripe.server");
    const stripe = getStripe();
    const amount = link.amount_cents as number;
    const currency = (link.currency ?? "EUR").toLowerCase();
    const fee = feeCents(amount, shop.stripe_platform_fee_bps);

    let customerEmail: string | undefined;
    if (link.customer_id) {
      const { data: c } = await supabaseAdmin
        .from("customers").select("email").eq("id", link.customer_id).maybeSingle();
      customerEmail = c?.email ?? undefined;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      customer_email: customerEmail,
      client_reference_id: link.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amount,
          product_data: {
            name: link.label || `Paiement ${link.bank_reference}`,
          },
        },
      }],
      payment_intent_data: {
        application_fee_amount: fee || undefined,
        metadata: {
          bpei_kind: "payment_link",
          bpei_shop_id: link.shop_id,
          bpei_payment_link_id: link.id,
          bpei_invoice_id: link.invoice_id ?? "",
        },
      },
      metadata: {
        bpei_kind: "payment_link",
        bpei_shop_id: link.shop_id,
        bpei_payment_link_id: link.id,
        bpei_invoice_id: link.invoice_id ?? "",
      },
    }, { stripeAccount: shop.stripe_account_id! });

    return { url: session.url!, sessionId: session.id };
  });

/** Authenticated: issue a refund on a Stripe payment (full or partial). */
export const refundStripePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; paymentId: string; amountCents?: number | null; reason?: string | null }) =>
    z.object({
      shopId: z.string().uuid(),
      paymentId: z.string().uuid(),
      amountCents: z.number().int().positive().nullable().optional(),
      reason: z.string().max(500).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    // Authorize as shop manager via RLS-scoped read
    const { data: pay, error } = await context.supabase
      .from("payments")
      .select("id, shop_id, amount_cents, refunded_amount_cents, provider, provider_reference, currency")
      .eq("id", data.paymentId)
      .eq("shop_id", data.shopId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pay) throw new Error("Paiement introuvable");
    if (pay.provider !== "stripe" || !pay.provider_reference) {
      throw new Error("Ce paiement n'est pas un paiement Stripe.");
    }
    const already = pay.refunded_amount_cents ?? 0;
    const max = (pay.amount_cents as number) - already;
    if (max <= 0) throw new Error("Ce paiement est déjà entièrement remboursé.");
    const amount = data.amountCents ? Math.min(data.amountCents, max) : max;

    const shop = await loadShopReadyForCharges(context.supabase, data.shopId);
    const { getStripe } = await import("@/lib/stripe.server");
    const stripe = getStripe();

    const refund = await stripe.refunds.create({
      payment_intent: pay.provider_reference!,
      amount,
      reason: data.reason ? undefined : undefined,
      refund_application_fee: true,
      reverse_transfer: true,
      metadata: {
        bpei_payment_id: pay.id,
        bpei_shop_id: pay.shop_id,
      },
    }, { stripeAccount: shop.stripe_account_id! });

    // The `charge.refunded` webhook will update payments + invoice.
    // We optimistically update refunded_amount_cents to reflect UI faster.
    return { refundId: refund.id, amount };
  });