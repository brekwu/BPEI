import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

const lineSchema = z.object({
  line_type: z.enum(["product", "service", "custom"]),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  quantity: z.number().min(0.001).max(10000),
  unit_price_cents: z.number().int().min(0).max(100_000_000),
  discount_percent: z.number().min(0).max(100).default(0),
  tax_rate: z.number().min(0).max(30).default(20),
  stock_item_id: z.string().uuid().nullable().optional(),
});

const inputSchema = z.object({
  shopId: uuid,
  readerId: uuid,
  customerId: uuid.nullable().optional(),
  source: z.enum(["free", "quote", "invoice", "repair"]).default("free"),
  sourceId: uuid.nullable().optional(),
  lines: z.array(lineSchema).min(1).max(50),
});

export const startTerminalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => inputSchema.parse(i))
  .handler(async ({ data, context }) => {
    const {
      assertShopManager, getStripe, stripeOptsFor, resolveShopStripeAccount,
      stripeEnvironment, readTerminalFlag, assertFlagAllows, safeMetadata,
    } = await import("./terminal.server");

    // Any shop member can create a payment (employees included), but manager for now.
    await assertShopManager(context.supabase, context.userId, data.shopId);
    const flag = await readTerminalFlag();
    const env = stripeEnvironment();
    assertFlagAllows(flag, env === "live");
    const acct = await resolveShopStripeAccount(data.shopId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reader } = await supabaseAdmin.from("terminal_readers")
      .select("*").eq("id", data.readerId).maybeSingle();
    if (!reader || reader.shop_id !== data.shopId) throw new Error("Lecteur introuvable");
    if (reader.livemode !== (env === "live")) throw new Error("Environnement lecteur / plateforme incompatible");
    if (!reader.active) throw new Error("Lecteur désactivé");

    // Compute totals
    let subtotal = 0, taxTotal = 0, discountTotal = 0;
    const linesWithTotals = data.lines.map((l) => {
      const gross = Math.round(l.quantity * l.unit_price_cents);
      const disc = Math.round(gross * (l.discount_percent / 100));
      const net = gross - disc;
      const tax = Math.round(net * (l.tax_rate / 100));
      subtotal += net;
      taxTotal += tax;
      discountTotal += disc;
      return { ...l, net_cents: net, tax_cents: tax };
    });
    const total = subtotal + taxTotal;
    if (total <= 0) throw new Error("Montant nul");

    // Create sale
    const { data: sale, error: se } = await supabaseAdmin.from("sales").insert({
      shop_id: data.shopId,
      customer_id: data.customerId ?? null,
      seller_id: context.userId,
      status: "draft",
      source: "counter",
      linked_quote_id: data.source === "quote" ? data.sourceId ?? null : null,
      linked_repair_id: data.source === "repair" ? data.sourceId ?? null : null,
      invoice_id: data.source === "invoice" ? data.sourceId ?? null : null,
      subtotal_excluding_tax_cents: subtotal,
      discount_total_cents: discountTotal,
      tax_total_cents: taxTotal,
      total_including_tax_cents: total,
      amount_paid_cents: 0,
      amount_due_cents: total,
    } as any).select("*").single();
    if (se) throw new Error(se.message);

    // Sale lines
    await supabaseAdmin.from("sale_lines").insert(linesWithTotals.map((l) => ({
      sale_id: sale.id,
      shop_id: data.shopId,
      line_type: l.line_type,
      stock_item_id: l.stock_item_id ?? null,
      name_snapshot: l.name,
      description_snapshot: l.description ?? null,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
      discount_percent: l.discount_percent,
      tax_rate: l.tax_rate,
    })) as any);

    // Local payment row (pending)
    const { data: pay, error: pe } = await supabaseAdmin.from("payments").insert({
      shop_id: data.shopId,
      customer_id: data.customerId ?? null,
      sale_id: sale.id,
      invoice_id: data.source === "invoice" ? data.sourceId ?? null : null,
      amount_cents: total,
      currency: "EUR",
      method: "card_terminal",
      status: "pending",
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

    // Create PaymentIntent on connected account (direct charges).
    const stripe = getStripe();
    const idem = `terminal-payment:${pay.id}:create`;
    const pi = await stripe.paymentIntents.create({
      amount: total,
      currency: "eur",
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      description: `Vente TPE #${sale.id.slice(0, 8)}`,
      metadata: safeMetadata({
        bpei_sale_id: sale.id,
        bpei_payment_id: pay.id,
        shop_id: data.shopId,
        source_type: data.source,
        source_id: data.sourceId ?? "",
        environment: env,
      }),
    }, { ...stripeOptsFor(acct.accountId), idempotencyKey: idem });

    await supabaseAdmin.from("payments").update({
      stripe_payment_intent_id: pi.id,
      provider_reference: pi.id,
      local_state: "waiting_for_reader",
    }).eq("id", pay.id);

    // Send to reader
    try {
      await stripe.terminal.readers.processPaymentIntent(
        reader.stripe_reader_id,
        { payment_intent: pi.id },
        stripeOptsFor(acct.accountId),
      );
      await supabaseAdmin.from("payments").update({ local_state: "presenting_card" }).eq("id", pay.id);
    } catch (e: any) {
      await supabaseAdmin.from("payments").update({
        local_state: "failed",
        status: "failed",
        terminal_last_error: e?.message ?? String(e),
      }).eq("id", pay.id);
      throw new Error(`Lecteur indisponible : ${e?.message ?? e}`);
    }

    return { paymentId: pay.id, saleId: sale.id, paymentIntentId: pi.id, amount_cents: total };
  });

export const getTerminalPaymentState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { paymentId: string }) => z.object({ paymentId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: pay, error } = await context.supabase
      .from("payments").select("*").eq("id", data.paymentId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!pay) throw new Error("Paiement introuvable");
    return pay;
  });

export const cancelTerminalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { paymentId: string }) => z.object({ paymentId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertShopManager, getStripe, stripeOptsFor } = await import("./terminal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay } = await supabaseAdmin.from("payments").select("*").eq("id", data.paymentId).maybeSingle();
    if (!pay) throw new Error("Paiement introuvable");
    await assertShopManager(context.supabase, context.userId, pay.shop_id);
    if (pay.status === "confirmed") throw new Error("Paiement déjà encaissé");

    const stripe = getStripe();
    if (pay.stripe_reader_id && pay.stripe_account_id) {
      try {
        await stripe.terminal.readers.cancelAction(pay.stripe_reader_id, {}, stripeOptsFor(pay.stripe_account_id));
      } catch {}
    }
    if (pay.stripe_payment_intent_id && pay.stripe_account_id) {
      try {
        await stripe.paymentIntents.cancel(pay.stripe_payment_intent_id, undefined, stripeOptsFor(pay.stripe_account_id));
      } catch {}
    }
    await supabaseAdmin.from("payments").update({
      status: "cancelled", local_state: "canceled",
    }).eq("id", data.paymentId);
    return { ok: true };
  });