import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ItemTypeZ = z.enum(["product", "part", "consumable"]);
const KindZ = z.enum(["in", "out", "adjust"]);

/* ============ ITEMS ============ */
export const listStockItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; includeArchived?: boolean }) =>
    z.object({ shopId: z.string().uuid(), includeArchived: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("stock_items").select("*").eq("shop_id", data.shopId);
    if (!data.includeArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q
      .order("category", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const stockStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("stock_items")
      .select("id,item_type,quantity,reserved_quantity,min_threshold,cost_price_cents,sell_price_cents,archived_at")
      .eq("shop_id", data.shopId)
      .is("archived_at", null);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const total = list.length;
    const low = list.filter((r: any) => Number(r.quantity) <= Number(r.min_threshold)).length;
    const out = list.filter((r: any) => Number(r.quantity) <= 0).length;
    const stockValueCents = list.reduce(
      (s: number, r: any) => s + Math.round(Number(r.quantity) * (r.cost_price_cents ?? 0)),
      0,
    );
    const potentialCents = list.reduce(
      (s: number, r: any) => s + Math.round(Number(r.quantity) * (r.sell_price_cents ?? 0)),
      0,
    );
    return { total, low, out, stockValueCents, potentialCents };
  });

const ItemUpsert = z.object({
  shopId: z.string().uuid(),
  id: z.string().uuid().optional(),
  sku: z.string().max(80).nullable().optional(),
  barcode: z.string().max(80).nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  brand: z.string().max(100).nullable().optional(),
  item_type: ItemTypeZ,
  unit: z.string().max(30).default("unité"),
  cost_price_cents: z.number().int().min(0),
  sell_price_cents: z.number().int().min(0),
  tax_rate: z.number().min(0).max(100),
  min_threshold: z.number().min(0),
  location: z.string().max(100).nullable().optional(),
  supplier_ref: z.string().max(100).nullable().optional(),
  active: z.boolean().default(true),
  initial_quantity: z.number().min(0).optional(),
});

export const upsertStockItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof ItemUpsert>) => ItemUpsert.parse(i))
  .handler(async ({ data, context }) => {
    const { shopId, id, initial_quantity, ...fields } = data;
    if (id) {
      const { data: row, error } = await context.supabase
        .from("stock_items").update(fields).eq("id", id).eq("shop_id", shopId)
        .select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("stock_items")
      .insert({ ...fields, shop_id: shopId, created_by: context.userId })
      .select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (row && initial_quantity && initial_quantity > 0) {
      await context.supabase.rpc("apply_stock_movement", {
        _shop_id: shopId, _item_id: row.id, _kind: "in",
        _quantity: initial_quantity, _reason: "création",
        _note: "stock initial",
      });
    }
    return row;
  });

export const archiveStockItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string; restore?: boolean }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid(), restore: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stock_items")
      .update({ archived_at: data.restore ? null : new Date().toISOString() })
      .eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStockItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stock_items")
      .delete().eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ MOVEMENTS ============ */
export const applyMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; itemId: string; kind: "in" | "out" | "adjust";
    quantity: number; reason?: string | null; note?: string | null;
    referenceType?: string | null; referenceId?: string | null;
  }) => z.object({
    shopId: z.string().uuid(),
    itemId: z.string().uuid(),
    kind: KindZ,
    quantity: z.number().positive(),
    reason: z.string().max(120).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
    referenceType: z.string().max(40).nullable().optional(),
    referenceId: z.string().uuid().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("apply_stock_movement", {
      _shop_id: data.shopId, _item_id: data.itemId, _kind: data.kind,
      _quantity: data.quantity, _reason: data.reason ?? undefined,
      _reference_type: data.referenceType ?? undefined, _reference_id: data.referenceId ?? undefined,
      _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const listMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; itemId?: string; limit?: number }) =>
    z.object({
      shopId: z.string().uuid(),
      itemId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("stock_movements")
      .select("*, item:stock_items(name,sku,unit)")
      .eq("shop_id", data.shopId);
    if (data.itemId) q = q.eq("item_id", data.itemId);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(data.limit ?? 200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ============ RESERVATIONS ============ */
export const createReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; itemId: string; quantity: number;
    referenceType?: string | null; referenceId?: string | null; note?: string | null;
  }) => z.object({
    shopId: z.string().uuid(),
    itemId: z.string().uuid(),
    quantity: z.number().positive(),
    referenceType: z.string().max(40).nullable().optional(),
    referenceId: z.string().uuid().nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: item, error: e1 } = await context.supabase.from("stock_items")
      .select("quantity,reserved_quantity").eq("id", data.itemId).eq("shop_id", data.shopId).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!item) throw new Error("Article introuvable");
    const available = Number(item.quantity) - Number(item.reserved_quantity);
    if (data.quantity > available) throw new Error(`Stock disponible insuffisant (${available})`);

    const { data: row, error } = await context.supabase.from("stock_reservations")
      .insert({
        shop_id: data.shopId, item_id: data.itemId, quantity: data.quantity,
        reference_type: data.referenceType ?? null, reference_id: data.referenceId ?? null,
        note: data.note ?? null, user_id: context.userId,
      }).select("*").maybeSingle();
    if (error) throw new Error(error.message);

    await context.supabase.from("stock_items")
      .update({ reserved_quantity: Number(item.reserved_quantity) + data.quantity })
      .eq("id", data.itemId).eq("shop_id", data.shopId);
    return row;
  });

export const releaseReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string; consume?: boolean }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid(), consume: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error: e1 } = await context.supabase.from("stock_reservations")
      .select("*").eq("id", data.id).eq("shop_id", data.shopId).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!r) throw new Error("Réservation introuvable");
    if (r.status !== "active") throw new Error("Réservation déjà clôturée");

    if (data.consume) {
      await context.supabase.rpc("apply_stock_movement", {
        _shop_id: data.shopId, _item_id: r.item_id, _kind: "out",
        _quantity: r.quantity, _reason: "consommation réservation",
        _reference_type: r.reference_type ?? undefined, _reference_id: r.reference_id ?? undefined, _note: r.note ?? undefined,
      });
    }

    const { data: item } = await context.supabase.from("stock_items")
      .select("reserved_quantity").eq("id", r.item_id).eq("shop_id", data.shopId).maybeSingle();
    const newReserved = Math.max(0, Number(item?.reserved_quantity ?? 0) - Number(r.quantity));
    await context.supabase.from("stock_items").update({ reserved_quantity: newReserved })
      .eq("id", r.item_id).eq("shop_id", data.shopId);

    await context.supabase.from("stock_reservations")
      .update({ status: data.consume ? "consumed" : "released", released_at: new Date().toISOString() })
      .eq("id", data.id).eq("shop_id", data.shopId);
    return { ok: true };
  });

export const listReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; status?: "active" | "consumed" | "released" }) =>
    z.object({ shopId: z.string().uuid(), status: z.enum(["active","consumed","released"]).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("stock_reservations")
      .select("*, item:stock_items(name,sku,unit)").eq("shop_id", data.shopId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ============ INVENTORIES ============ */
export const listInventories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("stock_inventories")
      .select("*").eq("shop_id", data.shopId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; name: string; note?: string | null }) =>
    z.object({
      shopId: z.string().uuid(),
      name: z.string().min(1).max(150),
      note: z.string().max(500).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: inv, error: e1 } = await context.supabase.from("stock_inventories")
      .insert({ shop_id: data.shopId, name: data.name, note: data.note ?? null,
                status: "in_progress", user_id: context.userId })
      .select("*").maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!inv) throw new Error("Erreur création inventaire");

    const { data: items } = await context.supabase.from("stock_items")
      .select("id,quantity").eq("shop_id", data.shopId).is("archived_at", null);
    if (items && items.length > 0) {
      const rows = items.map((it: any) => ({
        inventory_id: inv.id, shop_id: data.shopId, item_id: it.id,
        expected_qty: it.quantity, counted_qty: null,
      }));
      const { error: e2 } = await context.supabase.from("stock_inventory_lines").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    return inv;
  });

export const getInventoryLines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; inventoryId: string }) =>
    z.object({ shopId: z.string().uuid(), inventoryId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("stock_inventory_lines")
      .select("*, item:stock_items(name,sku,unit,category)")
      .eq("shop_id", data.shopId).eq("inventory_id", data.inventoryId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateInventoryLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string; countedQty: number | null; note?: string | null }) =>
    z.object({
      shopId: z.string().uuid(), id: z.string().uuid(),
      countedQty: z.number().nullable(), note: z.string().max(500).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stock_inventory_lines")
      .update({ counted_qty: data.countedQty, note: data.note ?? null })
      .eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; inventoryId: string }) =>
    z.object({ shopId: z.string().uuid(), inventoryId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: adjustments, error } = await context.supabase.rpc("close_stock_inventory", {
      _shop_id: data.shopId, _inventory_id: data.inventoryId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, adjustments: adjustments ?? 0 };
  });