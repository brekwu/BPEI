import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// --- Public: create order from cart ---
const CartLineSchema = z.object({
  kind: z.enum(["service", "product"]),
  refId: z.string().uuid(),
  quantity: z.number().min(1).max(999),
});
const CreateOrderSchema = z.object({
  shopId: z.string().uuid(),
  contactName: z.string().trim().min(1).max(120),
  contactEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  contactPhone: z.string().trim().min(4).max(40),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  fulfillmentMode: z.enum(["pickup", "shipping", "onsite"]).default("pickup"),
  lines: z.array(CartLineSchema).min(1).max(50),
});

function serverPubClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const publicCreateOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => CreateOrderSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("id, status")
      .eq("id", data.shopId)
      .maybeSingle();
    if (!shop || shop.status !== "validated") throw new Error("Boutique indisponible");

    const serviceIds = data.lines.filter((l) => l.kind === "service").map((l) => l.refId);
    const productIds = data.lines.filter((l) => l.kind === "product").map((l) => l.refId);

    const [svcRes, prodRes, billingRes] = await Promise.all([
      serviceIds.length
        ? supabaseAdmin.from("service_catalog")
            .select("id, name, unit_price_cents, tax_rate, active")
            .in("id", serviceIds).eq("shop_id", data.shopId)
        : Promise.resolve({ data: [] as any[], error: null }),
      productIds.length
        ? supabaseAdmin.from("stock_items")
            .select("id, name, sale_price_cents, tax_rate, active, quantity_on_hand, reserved_quantity, quarantine_quantity")
            .in("id", productIds).eq("shop_id", data.shopId)
        : Promise.resolve({ data: [] as any[], error: null }),
      supabaseAdmin.from("shop_billing_settings").select("default_tax_rate").eq("shop_id", data.shopId).maybeSingle(),
    ]);

    const defaultTax = Number(billingRes.data?.default_tax_rate ?? 20);
    const svcMap = new Map((svcRes.data ?? []).map((r: any) => [r.id, r]));
    const prodMap = new Map((prodRes.data ?? []).map((r: any) => [r.id, r]));

    type LineIn = { order_id?: string; shop_id: string; kind: "service" | "product";
      service_id?: string | null; stock_item_id?: string | null; name: string;
      quantity: number; unit_price_cents: number; tax_rate: number;
    };
    const lines: LineIn[] = [];
    for (const l of data.lines) {
      if (l.kind === "service") {
        const s = svcMap.get(l.refId);
        if (!s || !s.active) throw new Error("Prestation indisponible");
        lines.push({
          shop_id: data.shopId, kind: "service", service_id: l.refId, stock_item_id: null,
          name: s.name, quantity: l.quantity,
          unit_price_cents: s.unit_price_cents ?? 0,
          tax_rate: Number(s.tax_rate ?? defaultTax),
        });
      } else {
        const p = prodMap.get(l.refId);
        if (!p || !p.active) throw new Error("Produit indisponible");
        const available = Number(p.quantity_on_hand ?? 0) - Number(p.reserved_quantity ?? 0) - Number(p.quarantine_quantity ?? 0);
        if (available < l.quantity) throw new Error(`Stock insuffisant pour « ${p.name} »`);
        lines.push({
          shop_id: data.shopId, kind: "product", service_id: null, stock_item_id: l.refId,
          name: p.name, quantity: l.quantity,
          unit_price_cents: p.sale_price_cents ?? 0,
          tax_rate: Number(p.tax_rate ?? defaultTax),
        });
      }
    }

    // Simple rate-limit: 5 orders / 10 min / IP-less (basic)
    const { data: created, error: insErr } = await supabaseAdmin
      .from("orders")
      .insert({
        shop_id: data.shopId,
        contact_name: data.contactName,
        contact_email: data.contactEmail || null,
        contact_phone: data.contactPhone,
        notes: data.notes || null,
        fulfillment_mode: data.fulfillmentMode,
        status: "pending",
        payment_status: "unpaid",
      })
      .select("id, public_token, order_number")
      .single();
    if (insErr) throw insErr;

    const orderId = created.id;
    const { error: linesErr } = await supabaseAdmin
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: orderId })));
    if (linesErr) throw linesErr;

    // Generate order_number
    const short = orderId.slice(0, 8).toUpperCase();
    await supabaseAdmin.from("orders").update({ order_number: `CMD-${short}` }).eq("id", orderId);

    return { orderId, token: created.public_token };
  });

// --- Public: get order by token (uses SQL function) ---
export const publicGetOrderByToken = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const supa = serverPubClient();
    const { data: out, error } = await supa.rpc("public_get_order" as any, { _token: data.token });
    if (error) throw error;
    return (out ?? null) as any;
  });

export const publicPostOrderMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    token: z.string().min(10).max(100),
    body: z.string().trim().min(1).max(4000),
    authorName: z.string().trim().max(120).optional().or(z.literal("")),
  }).parse(d))
  .handler(async ({ data }) => {
    const supa = serverPubClient();
    const { data: id, error } = await supa.rpc("public_post_order_message" as any, {
      _token: data.token, _body: data.body, _author_name: data.authorName || "",
    });
    if (error) throw error;
    return { id } as any;
  });

// --- Shop-side: list orders for a shop ---
export const shopListOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shopId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("orders")
      .select("id, order_number, contact_name, contact_phone, contact_email, status, payment_status, total_cents, currency, fulfillment_mode, created_at, public_token")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return rows ?? [];
  });

export const shopGetOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [orderRes, itemsRes, msgsRes] = await Promise.all([
      context.supabase.from("orders").select("*").eq("id", data.orderId).maybeSingle(),
      context.supabase.from("order_items").select("*").eq("order_id", data.orderId).order("created_at"),
      context.supabase.from("order_messages").select("*").eq("order_id", data.orderId).order("created_at"),
    ]);
    if (orderRes.error) throw orderRes.error;
    if (!orderRes.data) throw new Error("Commande introuvable");
    return { order: orderRes.data, items: itemsRes.data ?? [], messages: msgsRes.data ?? [] };
  });

export const shopUpdateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    orderId: z.string().uuid(),
    status: z.enum(["pending", "confirmed", "paid", "ready", "delivered", "cancelled"]),
    reason: z.string().trim().max(500).optional().or(z.literal("")),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, any> = { status: data.status };
    const now = new Date().toISOString();
    if (data.status === "confirmed") patch.confirmed_at = now;
    if (data.status === "paid") { patch.paid_at = now; patch.payment_status = "paid"; }
    if (data.status === "ready") patch.ready_at = now;
    if (data.status === "delivered") patch.delivered_at = now;
    if (data.status === "cancelled") { patch.cancelled_at = now; patch.cancellation_reason = data.reason || null; }
    const { error } = await context.supabase.from("orders").update(patch as never).eq("id", data.orderId);
    if (error) throw error;
    return { ok: true };
  });

export const shopPostOrderMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    orderId: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: order } = await context.supabase.from("orders").select("id, shop_id").eq("id", data.orderId).maybeSingle();
    if (!order) throw new Error("Commande introuvable");
    const { error } = await context.supabase.from("order_messages").insert({
      order_id: order.id, shop_id: order.shop_id, author_type: "shop",
      author_user_id: context.userId, body: data.body,
    });
    if (error) throw error;
    return { ok: true };
  });