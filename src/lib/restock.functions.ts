import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* =========================================================
   Restock suggestions
   ========================================================= */
export const restockSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) =>
    z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const shopId = data.shopId;
    // 1. Active items
    const { data: items, error: itemsErr } = await context.supabase
      .from("stock_items")
      .select("id,name,sku,category,brand,unit,quantity,reserved_quantity,min_threshold,cost_price_cents,tax_rate")
      .eq("shop_id", shopId).is("archived_at", null)
      .eq("active", true);
    if (itemsErr) throw new Error(itemsErr.message);
    if (!items || items.length === 0) return [];

    const itemIds = items.map((i) => i.id);

    // 2. Primary suppliers per item
    const { data: sups } = await context.supabase
      .from("stock_item_suppliers")
      .select("id,stock_item_id,supplier_id,purchase_price_cents,tax_rate,min_order_qty,pack_qty,estimated_delivery_days,shipping_cost_cents,supplier_product_reference,is_primary,supplier:suppliers(id,name,default_lead_days,active,archived_at)")
      .eq("shop_id", shopId)
      .in("stock_item_id", itemIds)
      .eq("active", true);
    const supsByItem = new Map<string, any[]>();
    (sups ?? []).forEach((s: any) => {
      const arr = supsByItem.get(s.stock_item_id) ?? [];
      arr.push(s);
      supsByItem.set(s.stock_item_id, arr);
    });

    // 3. Consumption 7/30/90 days from stock_movements
    const now = Date.now();
    const d7 = new Date(now - 7 * 86400000).toISOString();
    const d30 = new Date(now - 30 * 86400000).toISOString();
    const d90 = new Date(now - 90 * 86400000).toISOString();
    const { data: moves } = await context.supabase
      .from("stock_movements")
      .select("stock_item_id,kind,quantity,created_at")
      .eq("shop_id", shopId)
      .in("stock_item_id", itemIds)
      .eq("kind", "out")
      .gte("created_at", d90);
    const usage = new Map<string, { d7: number; d30: number; d90: number }>();
    itemIds.forEach((id) => usage.set(id, { d7: 0, d30: 0, d90: 0 }));
    (moves ?? []).forEach((m: any) => {
      const u = usage.get(m.stock_item_id);
      if (!u) return;
      const qty = Math.abs(Number(m.quantity) || 0);
      const t = m.created_at;
      u.d90 += qty;
      if (t >= d30) u.d30 += qty;
      if (t >= d7) u.d7 += qty;
    });

    // 4. On-order quantities from open POs
    const { data: openLines } = await context.supabase
      .from("purchase_order_lines")
      .select("item_id,quantity,received_quantity,purchase_order:purchase_orders(status)")
      .eq("shop_id", shopId)
      .in("item_id", itemIds);
    const onOrder = new Map<string, number>();
    (openLines ?? []).forEach((l: any) => {
      const status = l.purchase_order?.status;
      if (!status || !["draft", "sent", "partial", "confirmed"].includes(status)) return;
      const remaining = Math.max(Number(l.quantity) - Number(l.received_quantity), 0);
      onOrder.set(l.item_id, (onOrder.get(l.item_id) ?? 0) + remaining);
    });

    // 5. Compute suggestions
    const suggestions = items.map((it: any) => {
      const stock = Number(it.quantity);
      const reserved = Number(it.reserved_quantity);
      const available = stock - reserved;
      const threshold = Number(it.min_threshold);
      const u = usage.get(it.id) ?? { d7: 0, d30: 0, d90: 0 };
      const on_order = onOrder.get(it.id) ?? 0;

      const primary = (supsByItem.get(it.id) ?? []).find((s: any) => s.is_primary)
        ?? (supsByItem.get(it.id) ?? [])[0];
      const leadDays = primary?.estimated_delivery_days ?? primary?.supplier?.default_lead_days ?? 7;
      const avgDaily = u.d30 / 30;
      // Target: threshold + lead-time demand + 20% safety
      const target = Math.max(threshold, Math.ceil(threshold + avgDaily * leadDays * 1.2));
      let recommended = Math.max(0, target - available - on_order);
      if (primary && recommended > 0) {
        const min = Number(primary.min_order_qty) || 1;
        const pack = Number(primary.pack_qty) || 1;
        recommended = Math.max(min, Math.ceil(recommended / pack) * pack);
      }

      let urgency: "critical" | "urgent" | "watch" | "normal";
      if (available <= 0) urgency = "critical";
      else if (available < threshold) urgency = "urgent";
      else if (available < threshold * 1.5) urgency = "watch";
      else urgency = "normal";

      const need = urgency !== "normal" || recommended > 0;
      const allSuppliers = (supsByItem.get(it.id) ?? []).map((s: any) => ({
        stock_item_supplier_id: s.id,
        supplier_id: s.supplier_id,
        supplier_name: s.supplier?.name ?? "—",
        supplier_active: s.supplier?.active !== false && !s.supplier?.archived_at,
        price_cents: s.purchase_price_cents,
        tax_rate: Number(s.tax_rate),
        min_order_qty: Number(s.min_order_qty ?? 1),
        pack_qty: Number(s.pack_qty ?? 1),
        delivery_days: s.estimated_delivery_days ?? s.supplier?.default_lead_days ?? null,
        shipping_cents: Number(s.shipping_cost_cents ?? 0),
        supplier_product_reference: s.supplier_product_reference ?? null,
        is_primary: !!s.is_primary,
      }));
      return {
        id: it.id, name: it.name, sku: it.sku, category: it.category, brand: it.brand,
        unit: it.unit, stock, reserved, available, threshold, on_order,
        consumption_7d: u.d7, consumption_30d: u.d30, consumption_90d: u.d90,
        avg_daily: Math.round(avgDaily * 100) / 100,
        lead_days: leadDays, recommended_qty: recommended, urgency,
        primary_supplier: primary ? {
          id: primary.id,
          supplier_id: primary.supplier_id,
          name: primary.supplier?.name ?? "—",
          price_cents: primary.purchase_price_cents,
          tax_rate: Number(primary.tax_rate),
          delivery_days: primary.estimated_delivery_days,
          min_order_qty: Number(primary.min_order_qty ?? 1),
          pack_qty: Number(primary.pack_qty ?? 1),
        } : null,
        all_suppliers: allSuppliers,
        supplier_count: (supsByItem.get(it.id) ?? []).length,
        need,
      };
    })
    .filter((s) => s.need)
    .sort((a, b) => {
      const order = { critical: 0, urgent: 1, watch: 2, normal: 3 } as const;
      const d = order[a.urgency] - order[b.urgency];
      if (d !== 0) return d;
      return b.consumption_30d - a.consumption_30d;
    });

    return suggestions;
  });

/* =========================================================
   Bulk PO creation grouped by supplier
   ========================================================= */
const BulkZ = z.object({
  shopId: z.string().uuid(),
  idempotencyKey: z.string().max(80).optional(),
  selections: z.array(z.object({
    item_id: z.string().uuid(),
    supplier_id: z.string().uuid(),
    stock_item_supplier_id: z.string().uuid().optional(),
    quantity: z.number().positive(),
    unit_price_cents: z.number().int().min(0),
    tax_rate: z.number().min(0).max(100).default(20),
    name: z.string().min(1).max(200),
    sku: z.string().max(80).nullable().optional(),
  })).min(1),
});

const _restockIdCache = new Map<string, { at: number; created: any[] }>();

export const createPurchaseOrdersFromRestock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof BulkZ>) => BulkZ.parse(i))
  .handler(async ({ data, context }) => {
    // Idempotence protection double-clic
    const idKey = data.idempotencyKey ? `${context.userId}::${data.idempotencyKey}` : null;
    if (idKey) {
      const now = Date.now();
      for (const [k, v] of _restockIdCache) if (now - v.at > 60_000) _restockIdCache.delete(k);
      const cached = _restockIdCache.get(idKey);
      if (cached) return { created: cached.created, replayed: true };
    }

    // Vérifier toutes les offres fournisseurs référencées (cohérence fournisseur stricte)
    const sisIds = data.selections.map((s) => s.stock_item_supplier_id).filter(Boolean) as string[];
    let sisMap = new Map<string, any>();
    if (sisIds.length > 0) {
      const { data: sisRows, error: eS } = await context.supabase
        .from("stock_item_suppliers")
        .select("id,supplier_id,shop_id,stock_item_id,min_order_qty,pack_qty")
        .in("id", sisIds);
      if (eS) throw new Error(eS.message);
      sisMap = new Map((sisRows ?? []).map((r: any) => [r.id, r]));
      for (const s of data.selections) {
        if (!s.stock_item_supplier_id) continue;
        const row = sisMap.get(s.stock_item_supplier_id);
        if (!row) throw new Error("Offre fournisseur introuvable");
        if (row.shop_id !== data.shopId) throw new Error("Offre d'une autre boutique");
        if (row.supplier_id !== s.supplier_id) throw new Error("Incohérence : offre / fournisseur");
        if (row.stock_item_id !== s.item_id) throw new Error("Incohérence : offre / article");
      }
    }

    // Group by supplier
    const groups = new Map<string, typeof data.selections>();
    for (const s of data.selections) {
      const arr = groups.get(s.supplier_id) ?? [];
      arr.push(s);
      groups.set(s.supplier_id, arr);
    }

    const created: Array<{
      po_id: string; reference: string; supplier_id: string;
      supplier_name: string; line_count: number; total_ht_cents: number;
    }> = [];

    const year = new Date().getFullYear();
    for (const [supplierId, lines] of groups) {
      const { count } = await context.supabase.from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", data.shopId)
        .gte("created_at", `${year}-01-01`);
      const ref = `BC-${year}-${String((count ?? 0) + 1 + created.length).padStart(4, "0")}`;

      const { data: sup } = await context.supabase.from("suppliers")
        .select("name").eq("id", supplierId).eq("shop_id", data.shopId).maybeSingle();

      const { data: po, error } = await context.supabase.from("purchase_orders")
        .insert({
          shop_id: data.shopId, supplier_id: supplierId, reference: ref,
          order_date: new Date().toISOString().slice(0, 10),
          status: "draft",
          notes: "Généré depuis le réapprovisionnement",
          created_by: context.userId,
        }).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      if (!po) throw new Error("Création PO échouée");

      const lineRows = lines.map((l, idx) => ({
        purchase_order_id: po.id, shop_id: data.shopId,
        item_id: l.item_id,
        stock_item_supplier_id: l.stock_item_supplier_id ?? null,
        name: l.name, sku: l.sku ?? null,
        quantity: l.quantity, unit_price_cents: l.unit_price_cents,
        tax_rate: l.tax_rate, position: idx,
      }));
      const { error: e2 } = await context.supabase.from("purchase_order_lines").insert(lineRows);
      if (e2) throw new Error(e2.message);

      await context.supabase.rpc("recompute_purchase_order_totals", { _po_id: po.id });

      const total = lines.reduce((s, l) => s + l.quantity * l.unit_price_cents, 0);
      created.push({
        po_id: po.id, reference: ref, supplier_id: supplierId,
        supplier_name: sup?.name ?? "Fournisseur",
        line_count: lines.length, total_ht_cents: total,
      });
    }

    if (idKey) _restockIdCache.set(idKey, { at: Date.now(), created });
    return { created };
  });