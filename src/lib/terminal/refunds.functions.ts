// TPE Refund — first version : TOTAL refund only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

/**
 * Full refund of a Terminal payment on the connected Stripe account, then
 * create a credit note (avoir) via the existing refund_sale RPC.
 *
 * First version : only TOTAL refunds. Partial refunds intentionally locked
 * until accounting requirements are frozen.
 */
export const refundTerminalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    paymentId: string;
    reason: string;
    restockConfirmed: boolean;
  }) => z.object({
    paymentId: uuid,
    reason: z.string().min(3).max(500),
    restockConfirmed: z.boolean(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertShopManager, getStripe, stripeOptsFor } = await import("./terminal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pay } = await supabaseAdmin.from("payments").select("*").eq("id", data.paymentId).maybeSingle();
    if (!pay) throw new Error("Paiement introuvable");
    await assertShopManager(context.supabase, context.userId, pay.shop_id);

    if (pay.provider !== "stripe" || pay.connector_type !== "stripe_terminal") {
      throw new Error("Ce paiement n'a pas été effectué au TPE.");
    }
    if (pay.status !== "confirmed") throw new Error("Seuls les paiements réussis peuvent être remboursés");
    if (pay.refunded_amount_cents && pay.refunded_amount_cents >= pay.amount_cents) {
      throw new Error("Paiement déjà remboursé intégralement");
    }
    if (!pay.stripe_payment_intent_id || !pay.stripe_account_id) {
      throw new Error("Identifiants Stripe manquants sur ce paiement");
    }
    if (!pay.sale_id) throw new Error("Vente associée introuvable");

    // Load sale lines for the credit note.
    const { data: lines } = await supabaseAdmin.from("sale_lines")
      .select("id, line_type, quantity, stock_item_id").eq("sale_id", pay.sale_id);
    if (!lines || lines.length === 0) throw new Error("Aucune ligne à rembourser");

    const stripe = getStripe();
    // Idempotency: use payment id so a retried click doesn't create two refunds.
    const idem = `terminal-refund:${pay.id}:total`;
    let refund;
    try {
      refund = await stripe.refunds.create({
        payment_intent: pay.stripe_payment_intent_id,
        reason: "requested_by_customer",
        metadata: {
          bpei_payment_id: pay.id,
          bpei_reason: data.reason.slice(0, 200),
        },
      }, { ...stripeOptsFor(pay.stripe_account_id), idempotencyKey: idem });
    } catch (e: any) {
      throw new Error(`Refus Stripe : ${e?.message ?? e}`);
    }

    // Save refund ref immediately (webhook may lag).
    await supabaseAdmin.from("payments").update({
      stripe_refund_id: refund.id,
      refunded_amount_cents: pay.amount_cents,
      status: (refund.status === "succeeded" ? "refunded" : pay.status) as any,
      local_state: refund.status === "succeeded" ? "refunded" : "refund_pending",
    } as any).eq("id", pay.id);

    // Create the credit note (avoir) via existing RPC — this handles numbering,
    // amounts, and optional stock restore based on the per-line action.
    const restockAction = data.restockConfirmed ? "restock" : "not_returned";
    const { data: cn, error: cnErr } = await context.supabase.rpc("refund_sale", {
      _sale_id: pay.sale_id,
      _lines: lines.map((l: any) => ({
        sale_line_id: l.id,
        quantity: Number(l.quantity ?? 0),
        // never restock a service
        restock: l.line_type === "product" ? restockAction : "not_returned",
      })) as any,
      _refund_method: "card_terminal" as any,
      _reason: data.reason,
      _reference: refund.id,
      _idempotency_key: idem,
    });
    if (cnErr) {
      // The Stripe refund is already accepted — do NOT re-throw as if nothing
      // happened. Surface a clear reconciliation message.
      throw new Error(
        `Remboursement Stripe effectué (${refund.id}) mais l'avoir n'a pas été créé : ${cnErr.message}. Ouvrez un ticket support avec cette référence.`,
      );
    }

    return {
      refundId: refund.id,
      refundStatus: refund.status,
      creditNote: cn as { credit_note_id: string; credit_note_number?: string; refunded_amount_cents?: number },
    };
  });