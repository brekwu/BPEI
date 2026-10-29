import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPaymentLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; status?: string | null }) =>
    z.object({
      shopId: z.string().uuid(),
      status: z.enum(["pending", "paid", "expired", "cancelled"]).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("payment_links")
      .select("*")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; amountCents: number; invoiceId?: string | null;
    customerId?: string | null; label?: string | null; expiresDays?: number | null;
    acceptedMethods?: string[];
  }) => z.object({
    shopId: z.string().uuid(),
    amountCents: z.number().int().positive(),
    invoiceId: z.string().uuid().nullable().optional(),
    customerId: z.string().uuid().nullable().optional(),
    label: z.string().max(200).nullable().optional(),
    expiresDays: z.number().int().min(1).max(365).nullable().optional(),
    acceptedMethods: z.array(z.string()).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("create_payment_link", {
      _shop_id: data.shopId,
      _amount_cents: data.amountCents,
      _invoice_id: data.invoiceId ?? undefined,
      _customer_id: data.customerId ?? undefined,
      _label: data.label ?? undefined,
      _expires_days: data.expiresDays ?? 30,
      _accepted_methods: data.acceptedMethods ?? ["bank_transfer"],
    });
    if (error) throw new Error(error.message);
    const first = Array.isArray(row) ? row[0] : row;
    return first as { id: string; token: string; bank_reference: string };
  });

export const cancelPaymentLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancel_payment_link", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordBankTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; amountCents: number; reference: string;
    paidAt?: string | null; invoiceId?: string | null; customerId?: string | null;
    notes?: string | null; paymentLinkId?: string | null;
  }) => z.object({
    shopId: z.string().uuid(),
    amountCents: z.number().int().positive(),
    reference: z.string().min(1).max(200),
    paidAt: z.string().nullable().optional(),
    invoiceId: z.string().uuid().nullable().optional(),
    customerId: z.string().uuid().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    paymentLinkId: z.string().uuid().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: paymentId, error } = await context.supabase.rpc("record_bank_transfer", {
      _shop_id: data.shopId,
      _amount_cents: data.amountCents,
      _reference: data.reference,
      _paid_at: data.paidAt ?? undefined,
      _invoice_id: data.invoiceId ?? undefined,
      _customer_id: data.customerId ?? undefined,
      _notes: data.notes ?? undefined,
      _payment_link_id: data.paymentLinkId ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { paymentId: paymentId as string };
  });

// ============ Owner console (bypasses RLS after role check) ============
async function assertOwner(ctx: any) {
  const { data: roles } = await ctx.supabase
    .from("user_platform_roles").select("role").eq("user_id", ctx.userId);
  const set = new Set((roles ?? []).map((r: any) => r.role));
  if (!set.has("owner_bpei") && !set.has("admin_bpei")) throw new Error("Accès refusé");
}

export const ownerListPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId?: string | null; from?: string | null; to?: string | null; method?: string | null; status?: string | null; provider?: string | null }) =>
    z.object({
      shopId: z.string().uuid().nullable().optional(),
      from: z.string().nullable().optional(),
      to: z.string().nullable().optional(),
      method: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      provider: z.string().nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("payments")
      .select("id, shop_id, invoice_id, amount_cents, currency, method, status, provider, provider_reference, reference, paid_at, notes, created_at, shops:shop_id(name)")
      .order("paid_at", { ascending: false })
      .limit(1000);
    if (data.shopId) q = q.eq("shop_id", data.shopId);
    if (data.from) q = q.gte("paid_at", data.from);
    if (data.to) q = q.lte("paid_at", data.to);
    if (data.method) q = q.eq("method", data.method as any);
    if (data.status) q = q.eq("status", data.status as any);
    if (data.provider) q = q.eq("provider", data.provider);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const ownerListPaymentLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId?: string | null; status?: string | null; from?: string | null; to?: string | null }) =>
    z.object({
      shopId: z.string().uuid().nullable().optional(),
      status: z.string().nullable().optional(),
      from: z.string().nullable().optional(),
      to: z.string().nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("payment_links")
      .select("id, shop_id, token, bank_reference, amount_cents, currency, status, label, expires_at, paid_at, created_at, shops:shop_id(name)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.shopId) q = q.eq("shop_id", data.shopId);
    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const ownerListShopsLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("shops")
      .select("id, name").order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });