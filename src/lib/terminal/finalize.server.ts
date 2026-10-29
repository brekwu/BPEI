// Server-only finalization for a successful Terminal PaymentIntent.
// Idempotent: safe to call multiple times for the same payment.
// Handles both:
//   - Case A: payment linked to an existing invoice → mark invoice paid.
//   - Case B: payment for a free sale / quote / repair with no invoice yet →
//             create a definitive numbered invoice via issue_invoice RPC.
export async function finalizeTerminalPayment(params: {
  paymentIntentId: string;
  accountId: string;
  livemode: boolean;
  chargeId?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pay, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("provider", "stripe")
    .eq("stripe_payment_intent_id", params.paymentIntentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!pay) {
    console.warn("[terminal.finalize] no local payment for PI", params.paymentIntentId);
    return { skipped: true };
  }
  if (pay.stripe_account_id && pay.stripe_account_id !== params.accountId) {
    throw new Error("event.account mismatch for payment");
  }
  if (pay.status === "confirmed") {
    // Still ensure invoice exists (idempotent re-entry after a previous failure).
    if (!pay.invoice_id && pay.sale_id) {
      await createInvoiceForCompletedSale(pay);
    }
    return { alreadyDone: true, invoiceId: pay.invoice_id ?? null };
  }

  // 1) Mark payment succeeded
  await supabaseAdmin.from("payments").update({
    status: "confirmed",
    local_state: "succeeded",
    stripe_charge_id: params.chargeId ?? pay.stripe_charge_id,
    card_brand: params.cardBrand ?? pay.card_brand,
    card_last4: params.cardLast4 ?? pay.card_last4,
    terminal_completed_at: new Date().toISOString(),
  }).eq("id", pay.id);

  // 2) Update sale amount_paid + amount_due
  if (pay.sale_id) {
    const { data: sale } = await supabaseAdmin.from("sales").select("*").eq("id", pay.sale_id).maybeSingle();
    if (sale) {
      const newPaid = (sale.amount_paid_cents ?? 0) + pay.amount_cents;
      const newDue = Math.max(0, (sale.total_including_tax_cents ?? 0) - newPaid);
      await supabaseAdmin.from("sales").update({
        amount_paid_cents: newPaid,
        amount_due_cents: newDue,
        status: newDue === 0 ? "completed" : sale.status,
        completed_at: newDue === 0 ? new Date().toISOString() : sale.completed_at,
      }).eq("id", pay.sale_id);
    }
  }

  // 3) Case A: linked to an invoice → decrement its amount_due.
  if (pay.invoice_id) {
    const { data: inv } = await supabaseAdmin.from("invoices")
      .select("amount_due_cents, amount_paid_cents").eq("id", pay.invoice_id).maybeSingle();
    if (inv) {
      const newPaid = (inv.amount_paid_cents ?? 0) + pay.amount_cents;
      const newDue = Math.max(0, (inv.amount_due_cents ?? 0) - pay.amount_cents);
      await supabaseAdmin.from("invoices").update({
        amount_paid_cents: newPaid,
        amount_due_cents: newDue,
        status: newDue === 0 ? "paid" : undefined,
        paid_at: newDue === 0 ? new Date().toISOString() : undefined,
      }).eq("id", pay.invoice_id);
    }
  }

  // 4) Case B: no invoice → auto-create a definitive numbered invoice from the sale.
  let createdInvoiceId: string | null = null;
  if (!pay.invoice_id && pay.sale_id) {
    createdInvoiceId = await createInvoiceForCompletedSale(pay);
  }

  // 5) Idempotent stock decrement for product sale lines.
  if (pay.sale_id) {
    const { data: lines } = await supabaseAdmin.from("sale_lines")
      .select("id, shop_id, line_type, stock_item_id, quantity, name_snapshot")
      .eq("sale_id", pay.sale_id);
    for (const ln of lines ?? []) {
      if (ln.line_type !== "product" || !ln.stock_item_id) continue;
      const { error: e } = await supabaseAdmin.from("stock_movements").insert({
        shop_id: ln.shop_id,
        stock_item_id: ln.stock_item_id,
        payment_id: pay.id,
        sale_line_id: ln.id,
        movement_type: "sale",
        quantity: -Number(ln.quantity ?? 0),
        reason: "Vente TPE",
      } as any);
      if (e && !/duplicate|unique/i.test(e.message)) {
        console.error("[terminal.finalize] stock movement error", e);
      }
    }
  }

  return { ok: true, paymentId: pay.id, invoiceId: pay.invoice_id ?? createdInvoiceId };
}

/**
 * Cas B — create a definitive invoice from a completed TPE sale.
 * - Idempotent: only creates if no invoice is already linked.
 * - Uses the existing `issue_invoice` RPC for atomic sequential numbering.
 * - Copies snapshots (billing/customer/legal) exactly like the manual flow.
 */
async function createInvoiceForCompletedSale(pay: any): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: sale } = await supabaseAdmin.from("sales").select("*").eq("id", pay.sale_id).maybeSingle();
  if (!sale) return null;
  if (sale.invoice_id) {
    // race-safe: another handler already created it.
    await supabaseAdmin.from("payments").update({ invoice_id: sale.invoice_id }).eq("id", pay.id);
    return sale.invoice_id;
  }

  const { data: lines } = await supabaseAdmin.from("sale_lines")
    .select("*").eq("sale_id", sale.id).order("id");
  if (!lines || lines.length === 0) return null;

  // Snapshots (billing/customer/legal)
  const [shopRes, settingsRes, custRes] = await Promise.all([
    supabaseAdmin.from("shops").select("name, address, city, postal_code, country, email, phone").eq("id", sale.shop_id).maybeSingle(),
    supabaseAdmin.from("shop_billing_settings").select("*").eq("shop_id", sale.shop_id).maybeSingle(),
    sale.customer_id
      ? supabaseAdmin.from("customers").select("*").eq("id", sale.customer_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);
  const settings = settingsRes.data as any;
  const billingSnap = { shop: shopRes.data, settings } as any;
  const customerSnap = custRes.data ?? null;

  // Insert invoice draft
  const { data: inv, error: invErr } = await supabaseAdmin.from("invoices").insert({
    shop_id: sale.shop_id,
    customer_id: sale.customer_id ?? null,
    repair_id: sale.linked_repair_id ?? null,
    quote_id: sale.linked_quote_id ?? null,
    billing_identity_snapshot: billingSnap,
    customer_identity_snapshot: customerSnap,
    legal_mentions_snapshot: settings?.extra_mentions ?? null,
    payment_terms_snapshot: settings?.payment_terms ?? null,
    created_by: pay.recorded_by ?? null,
  } as any).select("id").single();
  if (invErr) {
    console.error("[terminal.finalize] cas B — invoice draft failed", invErr);
    return null;
  }

  // Map sale_lines → invoice_lines
  const mapLineType = (t: string) => {
    if (t === "product") return "product";
    if (t === "service") return "service";
    return "other";
  };
  const rows = lines.map((l: any, idx: number) => ({
    shop_id: sale.shop_id,
    invoice_id: inv.id,
    line_type: mapLineType(l.line_type) as any,
    description: [l.name_snapshot, l.description_snapshot].filter(Boolean).join(" — ") || l.name_snapshot || "Ligne",
    quantity: l.quantity,
    unit: "unité",
    unit_price_cents: l.unit_price_cents,
    discount_percent: l.discount_percent ?? 0,
    tax_rate: l.tax_rate ?? 20,
    display_order: idx,
  }));
  const { error: linesErr } = await supabaseAdmin.from("invoice_lines").insert(rows as any);
  if (linesErr) {
    console.error("[terminal.finalize] cas B — invoice lines failed", linesErr);
    // Attempt cleanup of orphan draft.
    await supabaseAdmin.from("invoices").delete().eq("id", inv.id);
    return null;
  }

  // Recalc totals
  const { error: recErr } = await supabaseAdmin.rpc("recalc_invoice_totals", { _invoice_id: inv.id });
  if (recErr) console.error("[terminal.finalize] recalc totals failed", recErr);

  // Issue (atomic numbering via existing RPC — same sequence as manual invoices)
  const { data: num, error: issueErr } = await supabaseAdmin.rpc("issue_invoice", { _invoice_id: inv.id });
  if (issueErr) {
    console.error("[terminal.finalize] issue_invoice failed", issueErr);
    // Keep the draft; agent can retry manually.
    return inv.id;
  }

  // Mark invoice fully paid (amount == pay.amount_cents == sale total).
  await supabaseAdmin.from("invoices").update({
    amount_paid_cents: pay.amount_cents,
    amount_due_cents: 0,
    status: "paid",
    paid_at: new Date().toISOString(),
  }).eq("id", inv.id);

  // Link back everywhere
  await Promise.all([
    supabaseAdmin.from("sales").update({ invoice_id: inv.id }).eq("id", sale.id),
    supabaseAdmin.from("payments").update({ invoice_id: inv.id }).eq("id", pay.id),
  ]);

  console.info("[terminal.finalize] cas B — invoice", num, "created for sale", sale.id);
  return inv.id;
}