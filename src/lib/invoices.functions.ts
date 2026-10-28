import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; status?: string; repairId?: string }) =>
    z.object({ shopId: z.string().uuid(), status: z.string().optional(), repairId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("invoices")
      .select("id, invoice_number, status, issue_date, due_date, total_including_tax_cents, amount_paid_cents, amount_due_cents, currency, customer_id, repair_id, created_at")
      .eq("shop_id", data.shopId);
    if (data.status) q = q.eq("status", data.status as any);
    if (data.repairId) q = q.eq("repair_id", data.repairId);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; invoiceId: string }) =>
    z.object({ shopId: z.string().uuid(), invoiceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [inv, lines, payments] = await Promise.all([
      context.supabase.from("invoices").select("*").eq("id", data.invoiceId).eq("shop_id", data.shopId).maybeSingle(),
      context.supabase.from("invoice_lines").select("*").eq("invoice_id", data.invoiceId).order("display_order"),
      context.supabase.from("payments").select("*").eq("invoice_id", data.invoiceId).order("paid_at", { ascending: false }),
    ]);
    if (inv.error) throw new Error(inv.error.message);
    if (!inv.data) throw new Error("Facture introuvable");
    let customer = null;
    if (inv.data.customer_id) {
      const { data: c } = await context.supabase.from("customers").select("*").eq("id", inv.data.customer_id).maybeSingle();
      customer = c;
    }
    return { invoice: inv.data, lines: lines.data ?? [], payments: payments.data ?? [], customer };
  });

async function snapshots(supabase: any, shopId: string, customerId: string | null) {
  const [shopRes, settingsRes, custRes] = await Promise.all([
    supabase.from("shops").select("name, address, city, postal_code, country, email, phone").eq("id", shopId).maybeSingle(),
    supabase.from("shop_billing_settings").select("*").eq("shop_id", shopId).maybeSingle(),
    customerId ? supabase.from("customers").select("*").eq("id", customerId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    billing: { shop: shopRes.data, settings: settingsRes.data },
    customer: custRes.data ?? null,
    settings: settingsRes.data,
  };
}

export const createInvoiceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; customerId?: string | null; deviceId?: string | null;
    repairId?: string | null; customer_message?: string | null;
  }) => z.object({
    shopId: z.string().uuid(),
    customerId: z.string().uuid().nullable().optional(),
    deviceId: z.string().uuid().nullable().optional(),
    repairId: z.string().uuid().nullable().optional(),
    customer_message: z.string().max(2000).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const snap = await snapshots(context.supabase, data.shopId, data.customerId ?? null);
    const { data: row, error } = await context.supabase.from("invoices").insert({
      shop_id: data.shopId,
      customer_id: data.customerId ?? null,
      device_id: data.deviceId ?? null,
      repair_id: data.repairId ?? null,
      customer_message: data.customer_message ?? null,
      billing_identity_snapshot: snap.billing as any,
      customer_identity_snapshot: snap.customer as any,
      legal_mentions_snapshot: snap.settings?.extra_mentions ?? null,
      payment_terms_snapshot: snap.settings?.payment_terms ?? null,
      created_by: context.userId,
    }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row!;
  });

const LineInput = z.object({
  line_type: z.enum(["service", "product", "labour", "discount", "other"]).default("service"),
  catalog_item_id: z.string().uuid().nullable().optional(),
  description: z.string().min(1).max(500),
  quantity: z.number().min(0),
  unit: z.string().max(30).default("unité"),
  unit_price_cents: z.number().int(),
  discount_percent: z.number().min(0).max(100).default(0),
  tax_rate: z.number().min(0).max(100).default(20),
  display_order: z.number().int().default(0),
});

export const replaceInvoiceLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; invoiceId: string; lines: z.input<typeof LineInput>[] }) =>
    z.object({ shopId: z.string().uuid(), invoiceId: z.string().uuid(), lines: z.array(LineInput) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase.from("invoices").select("locked_at")
      .eq("id", data.invoiceId).eq("shop_id", data.shopId).maybeSingle();
    if (!inv) throw new Error("Facture introuvable");
    if (inv.locked_at) throw new Error("Facture verrouillée");
    await context.supabase.from("invoice_lines").delete().eq("invoice_id", data.invoiceId);
    if (data.lines.length) {
      const rows = data.lines.map((l, idx) => ({
        shop_id: data.shopId, invoice_id: data.invoiceId,
        line_type: l.line_type, catalog_item_id: l.catalog_item_id ?? null,
        description: l.description, quantity: l.quantity, unit: l.unit,
        unit_price_cents: l.unit_price_cents,
        discount_percent: l.discount_percent, tax_rate: l.tax_rate,
        display_order: l.display_order ?? idx,
      }));
      const { error } = await context.supabase.from("invoice_lines").insert(rows);
      if (error) throw new Error(error.message);
    }
    const { error: rErr } = await context.supabase.rpc("recalc_invoice_totals", { _invoice_id: data.invoiceId });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

export const issueInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; invoiceId: string }) =>
    z.object({ shopId: z.string().uuid(), invoiceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase.from("invoices").select("customer_id")
      .eq("id", data.invoiceId).eq("shop_id", data.shopId).maybeSingle();
    if (inv) {
      const snap = await snapshots(context.supabase, data.shopId, inv.customer_id);
      await context.supabase.from("invoices").update({
        billing_identity_snapshot: snap.billing as any,
        customer_identity_snapshot: snap.customer as any,
        legal_mentions_snapshot: snap.settings?.extra_mentions ?? null,
        payment_terms_snapshot: snap.settings?.payment_terms ?? null,
      }).eq("id", data.invoiceId);
    }
    const { data: num, error } = await context.supabase.rpc("issue_invoice", { _invoice_id: data.invoiceId });
    if (error) throw new Error(error.message);
    return { number: num as string };
  });