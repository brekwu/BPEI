import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildIdentitySnapshots(supabase: any, shopId: string, customerId: string | null) {
  const [shopRes, settingsRes, custRes] = await Promise.all([
    supabase.from("shops").select("name, address, city, postal_code, country, email, phone").eq("id", shopId).maybeSingle(),
    supabase.from("shop_billing_settings").select("*").eq("shop_id", shopId).maybeSingle(),
    customerId
      ? supabase.from("customers").select("*").eq("id", customerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const billing = { shop: shopRes.data, settings: settingsRes.data };
  return { billing_identity_snapshot: billing, customer_identity_snapshot: custRes.data ?? null };
}

export const listQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; repairId?: string; status?: string }) =>
    z.object({ shopId: z.string().uuid(), repairId: z.string().uuid().optional(), status: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("quotes")
      .select("id, quote_number, status, issue_date, valid_until, total_including_tax_cents, currency, customer_id, repair_id, created_at, accepted_at")
      .eq("shop_id", data.shopId);
    if (data.repairId) q = q.eq("repair_id", data.repairId);
    if (data.status) q = q.eq("status", data.status as any);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getQuote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; quoteId: string }) =>
    z.object({ shopId: z.string().uuid(), quoteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [q, lines, tokens, customer] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.quoteId).eq("shop_id", data.shopId).maybeSingle(),
      context.supabase.from("quote_lines").select("*").eq("quote_id", data.quoteId).order("display_order"),
      context.supabase.from("quote_public_tokens").select("*").eq("quote_id", data.quoteId).order("created_at", { ascending: false }),
      Promise.resolve(null),
    ]);
    if (q.error) throw new Error(q.error.message);
    if (!q.data) throw new Error("Devis introuvable");
    let cust = null;
    if (q.data.customer_id) {
      const { data: c } = await context.supabase.from("customers").select("*").eq("id", q.data.customer_id).maybeSingle();
      cust = c;
    }
    return { quote: q.data, lines: lines.data ?? [], tokens: tokens.data ?? [], customer: cust };
  });

const LineInput = z.object({
  id: z.string().uuid().optional(),
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

export const createQuoteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; customerId?: string | null; deviceId?: string | null;
    repairId?: string | null; customer_message?: string | null;
    internal_notes?: string | null; valid_until?: string | null;
    deposit_requested_cents?: number;
  }) => z.object({
    shopId: z.string().uuid(),
    customerId: z.string().uuid().nullable().optional(),
    deviceId: z.string().uuid().nullable().optional(),
    repairId: z.string().uuid().nullable().optional(),
    customer_message: z.string().max(2000).nullable().optional(),
    internal_notes: z.string().max(2000).nullable().optional(),
    valid_until: z.string().nullable().optional(),
    deposit_requested_cents: z.number().int().min(0).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const snapshots = await buildIdentitySnapshots(context.supabase, data.shopId, data.customerId ?? null);
    const settings = (snapshots.billing_identity_snapshot as any).settings;
    const validity = settings?.default_quote_validity_days ?? 30;
    const validUntil = data.valid_until ?? new Date(Date.now() + validity * 86400000).toISOString().slice(0, 10);
    const { data: row, error } = await context.supabase.from("quotes").insert({
      shop_id: data.shopId,
      customer_id: data.customerId ?? null,
      device_id: data.deviceId ?? null,
      repair_id: data.repairId ?? null,
      customer_message: data.customer_message ?? null,
      internal_notes: data.internal_notes ?? null,
      valid_until: validUntil,
      deposit_requested_cents: data.deposit_requested_cents ?? 0,
      terms_snapshot: settings?.extra_mentions ?? null,
      billing_identity_snapshot: snapshots.billing_identity_snapshot as any,
      customer_identity_snapshot: snapshots.customer_identity_snapshot as any,
      created_by: context.userId,
    }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row!;
  });

export const replaceQuoteLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; quoteId: string; lines: z.input<typeof LineInput>[] }) =>
    z.object({ shopId: z.string().uuid(), quoteId: z.string().uuid(), lines: z.array(LineInput) }).parse(i))
  .handler(async ({ data, context }) => {
    // Verify quote not locked
    const { data: q } = await context.supabase.from("quotes").select("locked_at, shop_id")
      .eq("id", data.quoteId).eq("shop_id", data.shopId).maybeSingle();
    if (!q) throw new Error("Devis introuvable");
    if (q.locked_at) throw new Error("Devis verrouillé");

    await context.supabase.from("quote_lines").delete().eq("quote_id", data.quoteId);
    if (data.lines.length) {
      const rows = data.lines.map((l, idx) => ({
        shop_id: data.shopId,
        quote_id: data.quoteId,
        line_type: l.line_type,
        catalog_item_id: l.catalog_item_id ?? null,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price_cents: l.unit_price_cents,
        discount_percent: l.discount_percent,
        tax_rate: l.tax_rate,
        display_order: l.display_order ?? idx,
      }));
      const { error } = await context.supabase.from("quote_lines").insert(rows);
      if (error) throw new Error(error.message);
    }
    // Recompute totals via SECURITY DEFINER function
    const { error: rErr } = await context.supabase.rpc("recalc_quote_totals", { _quote_id: data.quoteId });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

export const updateQuoteHeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; quoteId: string;
    customer_id?: string | null; device_id?: string | null;
    customer_message?: string | null; internal_notes?: string | null;
    valid_until?: string | null; deposit_requested_cents?: number;
  }) => z.object({
    shopId: z.string().uuid(), quoteId: z.string().uuid(),
    customer_id: z.string().uuid().nullable().optional(),
    device_id: z.string().uuid().nullable().optional(),
    customer_message: z.string().max(2000).nullable().optional(),
    internal_notes: z.string().max(2000).nullable().optional(),
    valid_until: z.string().nullable().optional(),
    deposit_requested_cents: z.number().int().min(0).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { shopId, quoteId, ...fields } = data;
    const patch: any = {};
    for (const [k, v] of Object.entries(fields)) if (v !== undefined) patch[k] = v;
    if (patch.customer_id !== undefined) {
      const snapshots = await buildIdentitySnapshots(context.supabase, shopId, patch.customer_id);
      patch.customer_identity_snapshot = snapshots.customer_identity_snapshot;
    }
    const { error } = await context.supabase.from("quotes").update(patch)
      .eq("id", quoteId).eq("shop_id", shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const issueQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; quoteId: string }) =>
    z.object({ shopId: z.string().uuid(), quoteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Refresh snapshot at emission
    const { data: q } = await context.supabase.from("quotes").select("customer_id")
      .eq("id", data.quoteId).eq("shop_id", data.shopId).maybeSingle();
    if (q) {
      const snap = await buildIdentitySnapshots(context.supabase, data.shopId, q.customer_id);
      await context.supabase.from("quotes").update({
        billing_identity_snapshot: snap.billing_identity_snapshot as any,
        customer_identity_snapshot: snap.customer_identity_snapshot as any,
      }).eq("id", data.quoteId);
    }
    const { data: num, error } = await context.supabase.rpc("issue_quote", { _quote_id: data.quoteId });
    if (error) throw new Error(error.message);
    return { number: num as string };
  });

export const cancelQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; quoteId: string }) =>
    z.object({ shopId: z.string().uuid(), quoteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: q } = await context.supabase.from("quotes").select("status")
      .eq("id", data.quoteId).eq("shop_id", data.shopId).maybeSingle();
    if (!q) throw new Error("Devis introuvable");
    if (["accepted", "converted"].includes(q.status)) throw new Error("Impossible d'annuler un devis accepté");
    const { error } = await context.supabase.from("quotes").update({ status: "cancelled" })
      .eq("id", data.quoteId).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createQuoteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; quoteId: string; ttlDays?: number }) =>
    z.object({ shopId: z.string().uuid(), quoteId: z.string().uuid(), ttlDays: z.number().int().min(1).max(365).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const token = randomToken();
    const expires_at = data.ttlDays
      ? new Date(Date.now() + data.ttlDays * 86400000).toISOString()
      : null;
    const { data: row, error } = await context.supabase.from("quote_public_tokens").insert({
      shop_id: data.shopId, quote_id: data.quoteId,
      token, expires_at, created_by: context.userId,
    }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row!;
  });

export const revokeQuoteToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; tokenId: string }) =>
    z.object({ shopId: z.string().uuid(), tokenId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quote_public_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.tokenId).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const convertQuoteToInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; quoteId: string }) =>
    z.object({ shopId: z.string().uuid(), quoteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: invId, error } = await context.supabase.rpc("convert_quote_to_invoice", { _quote_id: data.quoteId });
    if (error) throw new Error(error.message);
    return { invoiceId: invId as string };
  });