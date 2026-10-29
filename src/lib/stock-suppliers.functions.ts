import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ============ LIST ============ */
export const listItemSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; itemId: string }) =>
    z.object({ shopId: z.string().uuid(), itemId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("stock_item_suppliers")
      .select("*, supplier:suppliers(id,name,email,phone,default_lead_days)")
      .eq("shop_id", data.shopId)
      .eq("stock_item_id", data.itemId)
      .order("is_primary", { ascending: false })
      .order("purchase_price_cents", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ============ UPSERT ============ */
const UpsertZ = z.object({
  shopId: z.string().uuid(),
  id: z.string().uuid().optional(),
  stock_item_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  supplier_product_reference: z.string().max(120).nullable().optional(),
  supplier_product_name: z.string().max(200).nullable().optional(),
  purchase_price_cents: z.number().int().min(0),
  tax_rate: z.number().min(0).max(100).default(20),
  min_order_qty: z.number().positive().default(1),
  pack_qty: z.number().positive().default(1),
  estimated_delivery_days: z.number().int().min(0).max(365).nullable().optional(),
  shipping_cost_cents: z.number().int().min(0).default(0),
  is_primary: z.boolean().default(false),
  active: z.boolean().default(true),
  notes: z.string().max(1000).nullable().optional(),
});

export const upsertItemSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof UpsertZ>) => UpsertZ.parse(i))
  .handler(async ({ data, context }) => {
    const { shopId, id, is_primary, ...fields } = data;

    // If setting primary, demote others first
    if (is_primary) {
      await context.supabase.from("stock_item_suppliers")
        .update({ is_primary: false })
        .eq("shop_id", shopId)
        .eq("stock_item_id", data.stock_item_id)
        .neq("id", id ?? "00000000-0000-0000-0000-000000000000");
    }

    if (id) {
      const { data: row, error } = await context.supabase
        .from("stock_item_suppliers")
        .update({ ...fields, is_primary })
        .eq("id", id).eq("shop_id", shopId)
        .select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return row;
    }

    const { data: row, error } = await context.supabase
      .from("stock_item_suppliers")
      .insert({ ...fields, is_primary, shop_id: shopId, created_by: context.userId })
      .select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/* ============ DELETE ============ */
export const deleteItemSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stock_item_suppliers")
      .delete().eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ SET PRIMARY ============ */
export const setPrimaryItemSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string; itemId: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid(), itemId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Demote all
    await context.supabase.from("stock_item_suppliers")
      .update({ is_primary: false })
      .eq("shop_id", data.shopId).eq("stock_item_id", data.itemId);
    // Promote chosen
    const { error } = await context.supabase.from("stock_item_suppliers")
      .update({ is_primary: true })
      .eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ PRICE HISTORY ============ */
export const listPurchasePriceHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; itemId: string; supplierId?: string; limit?: number }) =>
    z.object({
      shopId: z.string().uuid(),
      itemId: z.string().uuid(),
      supplierId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("stock_purchase_price_history")
      .select("*, supplier:suppliers(id,name)")
      .eq("shop_id", data.shopId)
      .eq("stock_item_id", data.itemId);
    if (data.supplierId) q = q.eq("supplier_id", data.supplierId);
    const { data: rows, error } = await q
      .order("changed_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const prices = list.map((r: any) => r.new_price_cents as number).filter((n) => n > 0);
    const stats = prices.length > 0 ? {
      last: prices[0],
      min: Math.min(...prices),
      max: Math.max(...prices),
      changes: list.length,
    } : null;
    return { rows: list, stats };
  });