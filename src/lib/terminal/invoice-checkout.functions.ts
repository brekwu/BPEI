// Terminal checkout for an EXISTING invoice.
// The invoice remains the source of truth; a technical sale row is created
// only to hold the payment / stock trail and is linked back to the invoice.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const startInvoiceTerminalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; invoiceId: string; readerId: string }) =>
    z.object({ shopId: uuid, invoiceId: uuid, readerId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const {
      assertShopManager, getStripe, stripeOptsFor, resolveShopStripeAccount,
      stripeEnvironment, readTerminalFlag, assertFlagAllows, safeMetadata,
    } = await import("./terminal.server");
    await assertShopManager(context.supabase, context.userId, data.shopId);
    const flag = await readTerminalFlag();
    const env = stripeEnvironment();
    assertFlagAllows(flag, env === "live");
    const acct = await resolveShopStripeAccount(data.shopId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Load invoice from admin client to bypass any customer-scoped RLS quirks;
    // authorization is already handled by assertShopManager above.
    const { data: inv, error: invE } = await supabaseAdmin.from("invoices")
      .select("id, shop_id, status, amount_due_cents, customer_id, currency, invoice_number").eq("id", data.invoiceId).maybeSingle();
    if (invE) throw new Error(invE.message);
    if (!inv || inv.shop_id !== data.shopId) throw new Error("Facture introuvable");
    if ((inv.status as string) === "cancelled" || (inv.status as string) === "cancelled_by_credit_note") throw new Error("Facture annulée");
    const due = inv.amount_due_cents ?? 0;
    if (due <= 0) throw new Error("Facture déjà soldée");

    const { data: lines } = await supabaseAdmin.from("invoice_lines")
      .select("*").eq("invoice_id", data.invoiceId).order("display_order");
    if (!lines || lines.length === 0) throw new Error("Facture sans lignes");

    const { data: reader } = await supabaseAdmin.from("terminal_readers")
      .select("*").eq("id", data.readerId).maybeSingle();
    if (!reader || reader.shop_id !== data.shopId) throw new Error("Lecteur introuvable");
    if (reader.livemode !== (env === "live")) throw new Error("Environnement lecteur / plateforme incompatible");
    if (!reader.active) throw new Error("Lecteur désactivé");

    // Guard against concurrent unfinished terminal payment on this invoice.
    const { data: pending } = await supabaseAdmin.from("payments")
      .select("id").eq("invoice_id", data.invoiceId)
      .in("status", ["pending"] as any).limit(1);
    if (pending && pending.length > 0) {
      throw new Error("Un paiement TPE est déjà en cours pour cette facture");
    }

    // Total to charge = amount_due (may be < invoice total if partial payments already recorded).
    const totalToCharge = due;

    // Create a technical sale row so the payment/stock trail is coherent.
    const { data: sale, error: se } = await supabaseAdmin.from("sales").insert({
      shop_id: data.shopId,
      customer_id: inv.customer_id ?? null,
      seller_id: context.userId,
      status: "draft",
      source: "counter",
      invoice_id: data.invoiceId,
      subtotal_excluding_tax_cents: 0,
      discount_total_cents: 0,
      tax_total_cents: 0,
      total_including_tax_cents: totalToCharge,
      amount_paid_cents: 0,
      amount_due_cents: totalToCharge,
    } as any).select("id").single();
    if (se) throw new Error(se.message);

    // Copy invoice_lines → sale_lines for a proper stock trail on products.
    const saleLines = lines.map((l: any) => ({
      sale_id: sale.id,
      shop_id: data.shopId,
      line_type: (l.line_type === "product" ? "product" : l.line_type === "service" ? "service" : "custom") as any,
      stock_item_id: null, // invoice_lines does not carry it; stock ledger stays neutral for invoice-driven flows.
      name_snapshot: l.description ?? "Ligne facture",
      description_snapshot: null,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
      discount_percent: l.discount_percent ?? 0,
      tax_rate: l.tax_rate ?? 0,
    }));
    await supabaseAdmin.from("sale_lines").insert(saleLines as any);

    // Local payment (pending) — linked to the invoice.
    const { data: pay, error: pe } = await supabaseAdmin.from("payments").insert({
      shop_id: data.shopId,
      customer_id: inv.customer_id ?? null,
      sale_id: sale.id,
      invoice_id: data.invoiceId,
      amount_cents: totalToCharge,
      currency: inv.currency ?? "EUR",
      method: "card_terminal" as any,
      status: "pending" as any,
      provider: "stripe",
      connector_type: "stripe_terminal",
      stripe_account_id: acct.accountId,
      stripe_reader_id: reader.stripe_reader_id,
      livemode: env === "live",
      local_state: "creating_payment",
      terminal_started_at: new Date().toISOString(),
      recorded_by: context.userId,
    } as any).select("*").single();
    if (pe) throw new Error(pe.message);

    const stripe = getStripe();
    const idem = `terminal-payment:${pay.id}:create`;
    const pi = await stripe.paymentIntents.create({
      amount: totalToCharge,
      currency: (inv.currency ?? "eur").toLowerCase(),
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      description: `Facture ${inv.invoice_number ?? inv.id.slice(0, 8)}`,
      metadata: safeMetadata({
        bpei_sale_id: sale.id,
        bpei_payment_id: pay.id,
        bpei_invoice_id: data.invoiceId,
        shop_id: data.shopId,
        source_type: "invoice",
        environment: env,
      }),
    }, { ...stripeOptsFor(acct.accountId), idempotencyKey: idem });

    await supabaseAdmin.from("payments").update({
      stripe_payment_intent_id: pi.id,
      provider_reference: pi.id,
      local_state: "waiting_for_reader",
    } as any).eq("id", pay.id);

    try {
      await stripe.terminal.readers.processPaymentIntent(
        reader.stripe_reader_id,
        { payment_intent: pi.id },
        stripeOptsFor(acct.accountId),
      );
      await supabaseAdmin.from("payments").update({ local_state: "presenting_card" } as any).eq("id", pay.id);
    } catch (e: any) {
      await supabaseAdmin.from("payments").update({
        local_state: "failed",
        status: "failed" as any,
        terminal_last_error: e?.message ?? String(e),
      } as any).eq("id", pay.id);
      throw new Error(`Lecteur indisponible : ${e?.message ?? e}`);
    }

    return { paymentId: pay.id, saleId: sale.id, paymentIntentId: pi.id, amount_cents: totalToCharge };
  });

/**
 * List Terminal payments for a shop, joined with invoice number and customer name.
 * Used by /app/shop/$shopId/payments/terminal.
 */
export const listTerminalPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; limit?: number }) =>
    z.object({ shopId: uuid, limit: z.number().int().min(1).max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("payments")
      .select("id, created_at, amount_cents, currency, status, stripe_payment_intent_id, stripe_reader_id, invoice_id, sale_id, customer_id, card_brand, card_last4, livemode, refunded_amount_cents, stripe_refund_id, local_state, recorded_by, terminal_last_error")
      .eq("shop_id", data.shopId)
      .eq("provider", "stripe")
      .eq("connector_type", "stripe_terminal")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });