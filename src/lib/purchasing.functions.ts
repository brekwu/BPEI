import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const POStatusZ = z.enum(["draft","sent","confirmed","partial","late","received","cancelled","closed_variance"]);

/* ============ SUPPLIERS ============ */
export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; includeArchived?: boolean }) =>
    z.object({ shopId: z.string().uuid(), includeArchived: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("suppliers").select("*").eq("shop_id", data.shopId);
    if (!data.includeArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q.order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const SupplierUpsert = z.object({
  shopId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  contact_name: z.string().max(120).nullable().optional(),
  email: z.string().email().max(200).nullable().optional().or(z.literal("").transform(() => null)),
  phone: z.string().max(40).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  vat_number: z.string().max(40).nullable().optional(),
  payment_terms: z.string().max(120).nullable().optional(),
  default_lead_days: z.number().int().min(0).max(365).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  active: z.boolean().default(true),
});

export const upsertSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof SupplierUpsert>) => SupplierUpsert.parse(i))
  .handler(async ({ data, context }) => {
    const { shopId, id, ...fields } = data;
    if (id) {
      const { data: row, error } = await context.supabase.from("suppliers")
        .update(fields).eq("id", id).eq("shop_id", shopId).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("suppliers")
      .insert({ ...fields, shop_id: shopId, created_by: context.userId })
      .select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const archiveSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string; restore?: boolean }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid(), restore: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("suppliers")
      .update({ archived_at: data.restore ? null : new Date().toISOString() })
      .eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ PURCHASE ORDERS ============ */
export const listPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; status?: z.infer<typeof POStatusZ> }) =>
    z.object({ shopId: z.string().uuid(), status: POStatusZ.optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("purchase_orders")
      .select("*, supplier:suppliers(id,name)").eq("shop_id", data.shopId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPurchaseOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: po, error } = await context.supabase.from("purchase_orders")
      .select("*, supplier:suppliers(*), lines:purchase_order_lines(*)")
      .eq("id", data.id).eq("shop_id", data.shopId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!po) throw new Error("Bon de commande introuvable");
    // Sort lines by position
    if (Array.isArray(po.lines)) {
      po.lines = po.lines.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    }
    return po;
  });

const LineZ = z.object({
  item_id: z.string().uuid().nullable().optional(),
  stock_item_supplier_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  sku: z.string().max(80).nullable().optional(),
  quantity: z.number().positive(),
  unit_price_cents: z.number().int().min(0),
  tax_rate: z.number().min(0).max(100),
});

const POCreate = z.object({
  shopId: z.string().uuid(),
  supplier_id: z.string().uuid(),
  reference: z.string().min(1).max(60).optional(),
  order_date: z.string().optional(),
  expected_date: z.string().nullable().optional(),
  supplier_reference: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  lines: z.array(LineZ).min(1),
  idempotencyKey: z.string().max(80).optional(),
});

// Cache in-memory anti double-clic (server-side reset au cold-start ; suffisant côté navigateur rapide)
const _idempotencyCache = new Map<string, { at: number; poId: string }>();
function _idKey(userId: string, key: string) { return `${userId}::${key}`; }
function _idPurge() {
  const now = Date.now();
  for (const [k, v] of _idempotencyCache) if (now - v.at > 60_000) _idempotencyCache.delete(k);
}

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof POCreate>) => POCreate.parse(i))
  .handler(async ({ data, context }) => {
    // Idempotence (protection double-clic ~60 s par utilisateur)
    if (data.idempotencyKey) {
      _idPurge();
      const cached = _idempotencyCache.get(_idKey(context.userId, data.idempotencyKey));
      if (cached) return { id: cached.poId, replayed: true } as any;
    }

    // Vérifier chaque offre fournisseur avant création (fournisseur, boutique, article)
    if (data.lines.some((l) => l.stock_item_supplier_id)) {
      const ids = data.lines.map((l) => l.stock_item_supplier_id).filter(Boolean) as string[];
      const { data: sis, error: eS } = await context.supabase
        .from("stock_item_suppliers")
        .select("id,supplier_id,shop_id,stock_item_id,active")
        .in("id", ids);
      if (eS) throw new Error(eS.message);
      const sisMap = new Map((sis ?? []).map((r: any) => [r.id, r]));
      for (const l of data.lines) {
        if (!l.stock_item_supplier_id) continue;
        const row = sisMap.get(l.stock_item_supplier_id);
        if (!row) throw new Error("Offre fournisseur introuvable");
        if (row.shop_id !== data.shopId) throw new Error("Offre fournisseur d'une autre boutique");
        if (row.supplier_id !== data.supplier_id)
          throw new Error("Impossible : offre fournisseur d'un autre fournisseur que celui du bon");
        if (l.item_id && row.stock_item_id !== l.item_id)
          throw new Error("Offre fournisseur / article incohérents");
      }
    }

    let ref = data.reference?.trim();
    if (!ref) {
      const year = new Date().getFullYear();
      const { count } = await context.supabase.from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", data.shopId)
        .gte("created_at", `${year}-01-01`);
      ref = `BC-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;
    }
    const { data: po, error } = await context.supabase.from("purchase_orders")
      .insert({
        shop_id: data.shopId,
        supplier_id: data.supplier_id,
        reference: ref,
        order_date: data.order_date ?? new Date().toISOString().slice(0,10),
        expected_date: data.expected_date ?? null,
        supplier_reference: data.supplier_reference ?? null,
        notes: data.notes ?? null,
        status: "draft",
        created_by: context.userId,
      }).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!po) throw new Error("Création échouée");

    const lines = data.lines.map((l, idx) => ({
      purchase_order_id: po.id,
      shop_id: data.shopId,
      item_id: l.item_id ?? null,
      stock_item_supplier_id: l.stock_item_supplier_id ?? null,
      name: l.name.trim(),
      sku: l.sku ?? null,
      quantity: l.quantity,
      unit_price_cents: l.unit_price_cents,
      tax_rate: l.tax_rate,
      position: idx,
    }));
    const { error: e2 } = await context.supabase.from("purchase_order_lines").insert(lines);
    if (e2) throw new Error(e2.message);

    await context.supabase.rpc("recompute_purchase_order_totals", { _po_id: po.id });

    if (data.idempotencyKey) {
      _idempotencyCache.set(_idKey(context.userId, data.idempotencyKey), { at: Date.now(), poId: po.id });
    }
    return po;
  });

/* ============ Line management (draft only) ============ */
const LineUpsertZ = z.object({
  shopId: z.string().uuid(),
  poId: z.string().uuid(),
  lineId: z.string().uuid().optional(),
  item_id: z.string().uuid().nullable().optional(),
  stock_item_supplier_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  sku: z.string().max(80).nullable().optional(),
  quantity: z.number().positive(),
  unit_price_cents: z.number().int().min(0),
  tax_rate: z.number().min(0).max(100),
});

export const upsertPurchaseOrderLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof LineUpsertZ>) => LineUpsertZ.parse(i))
  .handler(async ({ data, context }) => {
    // Guard : PO doit être en brouillon (le trigger DB re-vérifie)
    const { data: po } = await context.supabase.from("purchase_orders")
      .select("id,status,supplier_id,shop_id")
      .eq("id", data.poId).eq("shop_id", data.shopId).maybeSingle();
    if (!po) throw new Error("Bon de commande introuvable");
    if (po.status !== "draft") throw new Error("Bon déjà envoyé : les lignes sont figées");

    if (data.stock_item_supplier_id) {
      const { data: sis } = await context.supabase.from("stock_item_suppliers")
        .select("id,supplier_id,shop_id,stock_item_id,min_order_qty,pack_qty")
        .eq("id", data.stock_item_supplier_id).maybeSingle();
      if (!sis) throw new Error("Offre fournisseur introuvable");
      if (sis.shop_id !== data.shopId) throw new Error("Offre d'une autre boutique");
      if (sis.supplier_id !== po.supplier_id) {
        throw new Error("Ce produit est proposé par un autre fournisseur. La ligne doit être déplacée vers un bon distinct correspondant à ce fournisseur.");
      }
      if (data.item_id && sis.stock_item_id !== data.item_id) {
        throw new Error("Offre fournisseur / article incohérents");
      }
      if (data.quantity < Number(sis.min_order_qty ?? 0)) {
        throw new Error(`Quantité inférieure au minimum fournisseur (${sis.min_order_qty})`);
      }
    }

    const payload = {
      purchase_order_id: data.poId,
      shop_id: data.shopId,
      item_id: data.item_id ?? null,
      stock_item_supplier_id: data.stock_item_supplier_id ?? null,
      name: data.name.trim(),
      sku: data.sku ?? null,
      quantity: data.quantity,
      unit_price_cents: data.unit_price_cents,
      tax_rate: data.tax_rate,
    };

    if (data.lineId) {
      const { error } = await context.supabase.from("purchase_order_lines")
        .update(payload).eq("id", data.lineId).eq("shop_id", data.shopId);
      if (error) throw new Error(error.message);
    } else {
      const { count } = await context.supabase.from("purchase_order_lines")
        .select("*", { count: "exact", head: true }).eq("purchase_order_id", data.poId);
      const { error } = await context.supabase.from("purchase_order_lines")
        .insert({ ...payload, position: count ?? 0 });
      if (error) throw new Error(error.message);
    }
    await context.supabase.rpc("recompute_purchase_order_totals", { _po_id: data.poId });
    return { ok: true };
  });

export const changePurchaseOrderSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; poId: string; supplier_id: string }) =>
    z.object({ shopId: z.string().uuid(), poId: z.string().uuid(), supplier_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: po } = await context.supabase.from("purchase_orders")
      .select("id,status,supplier_id").eq("id", data.poId).eq("shop_id", data.shopId).maybeSingle();
    if (!po) throw new Error("Bon introuvable");
    if (po.status !== "draft") throw new Error("Bon déjà envoyé : le fournisseur est figé");
    const { count } = await context.supabase.from("purchase_order_lines")
      .select("*", { count: "exact", head: true }).eq("purchase_order_id", data.poId);
    if ((count ?? 0) > 0) {
      throw new Error("Ce bon contient déjà des lignes. Videz-le ou créez un nouveau bon pour l'autre fournisseur.");
    }
    const { error } = await context.supabase.from("purchase_orders")
      .update({ supplier_id: data.supplier_id }).eq("id", data.poId).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const quarantineAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; itemId: string; quantity: number; action: "return_supplier"|"destroy"|"release"; note?: string | null }) =>
    z.object({
      shopId: z.string().uuid(),
      itemId: z.string().uuid(),
      quantity: z.number().positive(),
      action: z.enum(["return_supplier","destroy","release"]),
      note: z.string().max(1000).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("quarantine_action", {
      _shop_id: data.shopId,
      _item_id: data.itemId,
      _quantity: data.quantity,
      _action: data.action,
      _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listItemSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; itemId: string }) =>
    z.object({ shopId: z.string().uuid(), itemId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("stock_item_suppliers")
      .select("*, supplier:suppliers(id,name,default_lead_days,active,archived_at)")
      .eq("shop_id", data.shopId).eq("stock_item_id", data.itemId)
      .order("is_primary", { ascending: false })
      .order("purchase_price_cents", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });


export const updatePurchaseOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string; status: z.infer<typeof POStatusZ> }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid(), status: POStatusZ }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("purchase_orders")
      .update({ status: data.status })
      .eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Refuse si déjà (partiellement) reçu
    const { data: po } = await context.supabase.from("purchase_orders")
      .select("status").eq("id", data.id).eq("shop_id", data.shopId).maybeSingle();
    if (po && (po.status === "partial" || po.status === "received")) {
      throw new Error("Impossible de supprimer un bon de commande déjà réceptionné. Annulez-le.");
    }
    const { error } = await context.supabase.from("purchase_orders")
      .delete().eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const receiveLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; lineId: string; quantity: number;
    damaged?: number; note?: string | null; deliveryNote?: string | null;
  }) =>
    z.object({
      shopId: z.string().uuid(),
      lineId: z.string().uuid(),
      quantity: z.number().positive(),
      damaged: z.number().min(0).optional(),
      note: z.string().max(1000).nullable().optional(),
      deliveryNote: z.string().max(200).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("receive_purchase_order_line", {
      _shop_id: data.shopId, _line_id: data.lineId,
      _quantity: data.quantity,
      _note: data.note ?? undefined,
      _damaged: data.damaged ?? 0,
      _delivery_note: data.deliveryNote ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const receiveAllLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string; deliveryNote?: string | null }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid(), deliveryNote: z.string().max(200).nullable().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: lines, error } = await context.supabase.from("purchase_order_lines")
      .select("id,quantity,received_quantity")
      .eq("purchase_order_id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    let count = 0;
    for (const l of lines ?? []) {
      const remaining = Number(l.quantity) - Number(l.received_quantity);
      if (remaining > 0) {
        const { error: e2 } = await context.supabase.rpc("receive_purchase_order_line", {
          _shop_id: data.shopId, _line_id: l.id, _quantity: remaining,
          _note: "réception complète",
          _damaged: 0,
          _delivery_note: data.deliveryNote ?? undefined,
        });
        if (e2) throw new Error(e2.message);
        count++;
      }
    }
    return { ok: true, received: count };
  });

export const sendPurchaseOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("send_purchase_order", { _po_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closePurchaseOrderVariance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string; reason: string; note?: string | null }) =>
    z.object({
      shopId: z.string().uuid(), id: z.string().uuid(),
      reason: z.string().min(1).max(200),
      note: z.string().max(1000).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("close_purchase_order_variance", {
      _po_id: data.id, _reason: data.reason, _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPurchaseOrderStatusHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("purchase_order_status_history")
      .select("*")
      .eq("purchase_order_id", data.id).eq("shop_id", data.shopId)
      .order("changed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const purchasingStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("purchase_orders")
      .select("status,total_ht_cents").eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const open = list.filter((r: any) => ["draft","sent","partial"].includes(r.status)).length;
    const partial = list.filter((r: any) => r.status === "partial").length;
    const monthValueCents = list
      .filter((r: any) => ["sent","partial","received"].includes(r.status))
      .reduce((s: number, r: any) => s + (r.total_ht_cents ?? 0), 0);
    const { count: suppliersCount } = await context.supabase.from("suppliers")
      .select("*", { count: "exact", head: true }).eq("shop_id", data.shopId).is("archived_at", null);
    return { open, partial, monthValueCents, suppliers: suppliersCount ?? 0 };
  });

/* ============ SUPPLIER DETAIL (Vague 4) ============ */
export const getSupplier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; supplierId: string }) =>
    z.object({ shopId: z.string().uuid(), supplierId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("suppliers")
      .select("*").eq("id", data.supplierId).eq("shop_id", data.shopId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Fournisseur introuvable");
    return row;
  });

export const getSupplierStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; supplierId: string }) =>
    z.object({ shopId: z.string().uuid(), supplierId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .rpc("supplier_stats", { _supplier_id: data.supplierId });
    if (error) throw new Error(error.message);
    return row as any;
  });

export const listSupplierPurchaseOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; supplierId: string }) =>
    z.object({ shopId: z.string().uuid(), supplierId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("purchase_orders")
      .select("id,reference,status,order_date,expected_date,received_date,sent_at,total_ht_cents,total_ttc_cents")
      .eq("shop_id", data.shopId).eq("supplier_id", data.supplierId)
      .order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listSupplierItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; supplierId: string }) =>
    z.object({ shopId: z.string().uuid(), supplierId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("stock_item_suppliers")
      .select("*, stock_item:stock_items(id,name,sku,quantity,min_threshold,cost_price_cents,archived_at)")
      .eq("shop_id", data.shopId).eq("supplier_id", data.supplierId)
      .eq("active", true);
    if (error) throw new Error(error.message);
    return (rows ?? []).filter((r: any) => !r.stock_item?.archived_at);
  });

export const listSupplierPriceHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; supplierId: string; limit?: number }) =>
    z.object({ shopId: z.string().uuid(), supplierId: z.string().uuid(), limit: z.number().int().min(1).max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("stock_purchase_price_history")
      .select("*, stock_item:stock_items(id,name,sku)")
      .eq("shop_id", data.shopId).eq("supplier_id", data.supplierId)
      .order("changed_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });


/* ============ DASHBOARD (Vague 5) ============ */
export const purchasingDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; fromISO?: string; toISO?: string }) =>
    z.object({
      shopId: z.string().uuid(),
      fromISO: z.string().datetime().optional(),
      toISO: z.string().datetime().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const to = data.toISO ? new Date(data.toISO) : new Date();
    const from = data.fromISO ? new Date(data.fromISO)
      : new Date(new Date(to).setMonth(to.getMonth() - 11, 1));

    const { data: rows, error } = await context.supabase.from("purchase_orders")
      .select("id,reference,status,order_date,expected_date,received_date,sent_at,total_ht_cents,total_ttc_cents,supplier_id,created_at,supplier:suppliers(id,name)")
      .eq("shop_id", data.shopId)
      .gte("created_at", from.toISOString())
      .lte("created_at", to.toISOString())
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];

    const countedStatuses = ["sent","confirmed","partial","late","received","closed_variance"];
    const valued = list.filter(r => countedStatuses.includes(r.status));

    const totalHtCents = valued.reduce((s, r) => s + (r.total_ht_cents ?? 0), 0);
    const totalTtcCents = valued.reduce((s, r) => s + (r.total_ttc_cents ?? 0), 0);
    const ordersCount = valued.length;

    // by status (all rows in period)
    const byStatus: Record<string, { count: number; ht_cents: number }> = {};
    for (const r of list) {
      const k = r.status as string;
      byStatus[k] = byStatus[k] ?? { count: 0, ht_cents: 0 };
      byStatus[k].count++;
      byStatus[k].ht_cents += r.total_ht_cents ?? 0;
    }

    // monthly evolution (12 buckets from `from`)
    const months: { key: string; label: string; count: number; ht_cents: number }[] = [];
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: cursor.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        count: 0,
        ht_cents: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const monthIdx = new Map(months.map((m, i) => [m.key, i]));
    for (const r of valued) {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const i = monthIdx.get(key);
      if (i !== undefined) {
        months[i].count++;
        months[i].ht_cents += r.total_ht_cents ?? 0;
      }
    }

    // top suppliers by HT value
    const supAgg = new Map<string, { supplier_id: string; name: string; count: number; ht_cents: number }>();
    for (const r of valued) {
      const sid = r.supplier_id as string | null;
      if (!sid) continue;
      const cur = supAgg.get(sid) ?? { supplier_id: sid, name: r.supplier?.name ?? "—", count: 0, ht_cents: 0 };
      cur.count++;
      cur.ht_cents += r.total_ht_cents ?? 0;
      supAgg.set(sid, cur);
    }
    const topSuppliers = Array.from(supAgg.values())
      .sort((a, b) => b.ht_cents - a.ht_cents).slice(0, 10);

    // reliability
    const receivedRows = list.filter(r => r.status === "received" && r.received_date && r.expected_date);
    let onTime = 0, late = 0, delaySum = 0;
    for (const r of receivedRows) {
      const exp = new Date(r.expected_date).getTime();
      const rec = new Date(r.received_date).getTime();
      const diffDays = Math.round((rec - exp) / 86400000);
      if (diffDays <= 0) onTime++; else { late++; delaySum += diffDays; }
    }
    const onTimeRate = receivedRows.length ? Math.round((onTime / receivedRows.length) * 100) : null;
    const avgDelayDays = late ? Math.round(delaySum / late) : 0;

    const lateOpen = list.filter(r => r.status === "late").length;
    const varianceClosed = list.filter(r => r.status === "closed_variance").length;

    return {
      period: { fromISO: from.toISOString(), toISO: to.toISOString() },
      kpis: {
        ordersCount,
        totalHtCents,
        totalTtcCents,
        avgOrderHtCents: ordersCount ? Math.round(totalHtCents / ordersCount) : 0,
        onTimeRate,
        avgDelayDays,
        lateOpen,
        varianceClosed,
      },
      byStatus,
      months,
      topSuppliers,
    };
  });

/* ============ PDF (Vague 6) ============ */
export const getPurchaseOrderPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: po, error } = await context.supabase.from("purchase_orders")
      .select("*, supplier:suppliers(*), lines:purchase_order_lines(*)")
      .eq("id", data.id).eq("shop_id", data.shopId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!po) throw new Error("Bon de commande introuvable");
    const isDraft = po.status === "draft";
    const shopSnap = (po as any).shop_snapshot ?? null;
    const supSnap = (po as any).supplier_snapshot ?? null;
    const linesSnap = (po as any).lines_snapshot ?? null;

    // Live shop for logo + fallback header
    const { data: liveShop } = await context.supabase.from("shops")
      .select("*").eq("id", data.shopId).maybeSingle();
    const { data: settings } = await context.supabase.from("shop_billing_settings")
      .select("logo_url,siret,vat_number").eq("shop_id", data.shopId).maybeSingle();

    const shop = shopSnap ?? liveShop ?? {};
    const supplier = supSnap ?? po.supplier ?? {};
    const linesRaw: any[] = Array.isArray(linesSnap) && linesSnap.length > 0
      ? linesSnap
      : (po.lines ?? []);
    const lines = linesRaw
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((l: any) => ({
        position: l.position ?? 0,
        name: l.item_name ?? l.name ?? "—",
        sku: l.item_sku ?? l.sku ?? null,
        quantity: Number(l.quantity ?? 0),
        unit: l.unit ?? null,
        unit_price_cents: Number(l.unit_price_cents ?? 0),
        tax_rate: Number(l.tax_rate ?? 0),
        notes: l.notes ?? null,
      }));

    const { loadLogoDataUrl } = await import("./pdf/logo-loader.server");
    const logoUrl = (shop as any).logo_url ?? settings?.logo_url ?? null;
    const logo_data_url = await loadLogoDataUrl(logoUrl);

    const { renderPurchaseOrderPdfBase64 } = await import("./pdf/purchase-order.server");
    const base64 = await renderPurchaseOrderPdfBase64({
      reference: po.reference ?? "BC-BROUILLON",
      order_date: po.order_date ?? po.created_at,
      expected_date: po.expected_date ?? null,
      sent_at: (po as any).sent_at ?? null,
      status: po.status,
      currency: "EUR",
      shop: {
        name: shop.name, legal_name: (shop as any).legal_name,
        address_line1: (shop as any).address_line1 ?? (shop as any).address,
        address_line2: (shop as any).address_line2,
        postal_code: (shop as any).postal_code, city: (shop as any).city,
        country: (shop as any).country, email: (shop as any).email,
        phone: (shop as any).phone,
        siret: (shop as any).siret ?? settings?.siret ?? null,
        vat_number: (shop as any).vat_number ?? settings?.vat_number ?? null,
      },
      supplier: {
        name: supplier.name,
        contact_name: (supplier as any).contact_name,
        address_line1: (supplier as any).address_line1 ?? (supplier as any).address,
        address_line2: (supplier as any).address_line2,
        postal_code: (supplier as any).postal_code, city: (supplier as any).city,
        country: (supplier as any).country, email: (supplier as any).email,
        phone: (supplier as any).phone, vat_number: (supplier as any).vat_number,
        payment_terms: (supplier as any).payment_terms,
        lead_time_days: (supplier as any).lead_time_days ?? (supplier as any).default_lead_days,
      },
      lines,
      subtotal_ht_cents: Number(po.total_ht_cents ?? 0),
      tax_cents: Number((po.total_ttc_cents ?? 0) - (po.total_ht_cents ?? 0)),
      total_ht_cents: Number(po.total_ht_cents ?? 0),
      total_ttc_cents: Number(po.total_ttc_cents ?? 0),
      notes: (po as any).notes ?? null,
      logo_data_url,
      is_draft: isDraft,
    });

    const filename = `${(po.reference ?? "bon-de-commande").replace(/[^a-zA-Z0-9._-]+/g, "-")}.pdf`;
    return { base64, filename, isDraft, supplierEmail: (supplier as any).email ?? null };
  });

/* ============ VAGUE 11 — Création directe d'un bon depuis un article ============ */
const CreatePOFromItemZ = z.object({
  shopId: z.string().uuid(),
  itemId: z.string().uuid(),
  stockItemSupplierId: z.string().uuid(),
  quantity: z.number().positive(),
  target: z.enum(["new", "existing"]).default("new"),
  existingPoId: z.string().uuid().optional(),
  idempotencyKey: z.string().max(80).optional(),
});

const _fromItemCache = new Map<string, { at: number; poId: string; lineId?: string }>();
function _cachePurge() {
  const now = Date.now();
  for (const [k, v] of _fromItemCache) if (now - v.at > 60_000) _fromItemCache.delete(k);
}

export const createPOFromItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof CreatePOFromItemZ>) => CreatePOFromItemZ.parse(i))
  .handler(async ({ data, context }) => {
    if (data.idempotencyKey) {
      _cachePurge();
      const c = _fromItemCache.get(`${context.userId}::${data.idempotencyKey}`);
      if (c) return { poId: c.poId, lineId: c.lineId, replayed: true };
    }

    // Load offer (server is source of truth for price/min/pack)
    const { data: offer, error: eO } = await context.supabase.from("stock_item_suppliers")
      .select("id,shop_id,stock_item_id,supplier_id,purchase_price_cents,tax_rate,min_order_qty,pack_qty,supplier_product_reference,supplier_product_name,estimated_delivery_days,shipping_cost_cents,active")
      .eq("id", data.stockItemSupplierId).maybeSingle();
    if (eO) throw new Error(eO.message);
    if (!offer) throw new Error("Offre fournisseur introuvable");
    if (offer.shop_id !== data.shopId) throw new Error("Offre d'une autre boutique");
    if (offer.stock_item_id !== data.itemId) throw new Error("Offre / article incohérents");
    if (!offer.active) throw new Error("Offre fournisseur inactive");

    // Load item (name/sku)
    const { data: item, error: eI } = await context.supabase.from("stock_items")
      .select("id,shop_id,name,sku").eq("id", data.itemId).maybeSingle();
    if (eI) throw new Error(eI.message);
    if (!item || item.shop_id !== data.shopId) throw new Error("Article introuvable");

    // Quantity rounding — snap up to min then to pack multiple
    const minQ = Number(offer.min_order_qty ?? 1);
    const packQ = Math.max(1, Number(offer.pack_qty ?? 1));
    let qty = Math.max(data.quantity, minQ);
    if (packQ > 1) qty = Math.ceil(qty / packQ) * packQ;
    if (qty <= 0) throw new Error("Quantité invalide");

    let poId: string;
    let lineId: string | undefined;

    if (data.target === "existing") {
      if (!data.existingPoId) throw new Error("Bon de commande cible manquant");
      const { data: po, error: eP } = await context.supabase.from("purchase_orders")
        .select("id,status,supplier_id,shop_id")
        .eq("id", data.existingPoId).eq("shop_id", data.shopId).maybeSingle();
      if (eP) throw new Error(eP.message);
      if (!po) throw new Error("Brouillon introuvable");
      if (po.status !== "draft") throw new Error("Le bon ciblé n'est plus en brouillon");
      if (po.supplier_id !== offer.supplier_id)
        throw new Error("Ce brouillon appartient à un autre fournisseur");
      poId = po.id;

      const { count } = await context.supabase.from("purchase_order_lines")
        .select("*", { count: "exact", head: true }).eq("purchase_order_id", poId);
      const { data: newLine, error: eL } = await context.supabase.from("purchase_order_lines")
        .insert({
          purchase_order_id: poId,
          shop_id: data.shopId,
          item_id: data.itemId,
          stock_item_supplier_id: offer.id,
          name: item.name,
          sku: item.sku,
          quantity: qty,
          unit_price_cents: offer.purchase_price_cents,
          tax_rate: offer.tax_rate ?? 20,
          position: count ?? 0,
        }).select("id").maybeSingle();
      if (eL) throw new Error(eL.message);
      lineId = newLine?.id;
    } else {
      // Create new draft
      const year = new Date().getFullYear();
      const { count } = await context.supabase.from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", data.shopId).gte("created_at", `${year}-01-01`);
      const ref = `BC-${year}-${String((count ?? 0) + 1).padStart(4, "0")}`;

      const { data: po, error: eC } = await context.supabase.from("purchase_orders")
        .insert({
          shop_id: data.shopId,
          supplier_id: offer.supplier_id,
          reference: ref,
          order_date: new Date().toISOString().slice(0, 10),
          status: "draft",
          created_by: context.userId,
        }).select("id").maybeSingle();
      if (eC) throw new Error(eC.message);
      if (!po) throw new Error("Création échouée");
      poId = po.id;

      const { data: newLine, error: eL } = await context.supabase.from("purchase_order_lines")
        .insert({
          purchase_order_id: poId,
          shop_id: data.shopId,
          item_id: data.itemId,
          stock_item_supplier_id: offer.id,
          name: item.name,
          sku: item.sku,
          quantity: qty,
          unit_price_cents: offer.purchase_price_cents,
          tax_rate: offer.tax_rate ?? 20,
          position: 0,
        }).select("id").maybeSingle();
      if (eL) throw new Error(eL.message);
      lineId = newLine?.id;
    }

    await context.supabase.rpc("recompute_purchase_order_totals", { _po_id: poId });

    if (data.idempotencyKey) {
      _fromItemCache.set(`${context.userId}::${data.idempotencyKey}`, { at: Date.now(), poId, lineId });
    }
    return { poId, lineId, quantity: qty };
  });

/** List existing draft POs for a given supplier (offer add target) */
export const listSupplierDraftPOs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; supplierId: string }) =>
    z.object({ shopId: z.string().uuid(), supplierId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("purchase_orders")
      .select("id,reference,order_date,total_ht_cents")
      .eq("shop_id", data.shopId).eq("supplier_id", data.supplierId).eq("status", "draft")
      .order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Consumption over N days (helper for quantity suggestions) */
export const itemConsumption = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; itemId: string; days?: number }) =>
    z.object({ shopId: z.string().uuid(), itemId: z.string().uuid(), days: z.number().int().min(1).max(365).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc("consumption_last_days", {
      _shop_id: data.shopId, _item_id: data.itemId, _days: data.days ?? 30,
    });
    if (error) throw new Error(error.message);
    return { days: data.days ?? 30, consumed: Number(r ?? 0) };
  });

/** Currently ordered (open drafts + sent + confirmed + partial) qty for an item */
export const itemOnOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; itemId: string }) =>
    z.object({ shopId: z.string().uuid(), itemId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("purchase_order_lines")
      .select("quantity,received_quantity,purchase_orders!inner(status,shop_id)")
      .eq("shop_id", data.shopId).eq("item_id", data.itemId);
    if (error) throw new Error(error.message);
    const openStatuses = new Set(["draft", "sent", "confirmed", "partial", "late"]);
    let onOrder = 0;
    for (const r of rows ?? []) {
      const po = (r as any).purchase_orders;
      if (!po || !openStatuses.has(po.status)) continue;
      onOrder += Math.max(0, Number(r.quantity) - Number((r as any).received_quantity ?? 0));
    }
    return { onOrder };
  });

/* ============ VAGUE 11 — Quarantaine ============ */
export const listQuarantine = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; search?: string; supplierId?: string }) =>
    z.object({
      shopId: z.string().uuid(),
      search: z.string().max(200).optional(),
      supplierId: z.string().uuid().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("stock_items")
      .select("id,name,sku,barcode,category,quarantine_quantity,quantity,reserved_quantity,min_threshold")
      .eq("shop_id", data.shopId)
      .gt("quarantine_quantity", 0)
      .order("name", { ascending: true });
    if (data.search) {
      const s = data.search.trim();
      q = q.or(`name.ilike.%${s}%,sku.ilike.%${s}%,barcode.ilike.%${s}%`);
    }
    const { data: items, error } = await q;
    if (error) throw new Error(error.message);
    return items ?? [];
  });

export const listQuarantineMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; itemId?: string; limit?: number }) =>
    z.object({ shopId: z.string().uuid(), itemId: z.string().uuid().optional(), limit: z.number().int().min(1).max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("stock_movements")
      .select("*, item:stock_items(id,name,sku)")
      .eq("shop_id", data.shopId)
      .in("kind", ["quarantine_in", "quarantine_out", "quarantine_release"])
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.itemId) q = q.eq("item_id", data.itemId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ============ VAGUE 11 — Réception avec gestion d'écart de prix ============ */
const ReceiveWithVarianceZ = z.object({
  shopId: z.string().uuid(),
  lineId: z.string().uuid(),
  quantity: z.number().positive(),
  damaged: z.number().min(0).optional(),
  note: z.string().max(1000).nullable().optional(),
  deliveryNote: z.string().max(200).nullable().optional(),
  actualUnitPriceCents: z.number().int().min(0).optional(),
  decision: z.enum(["none", "accept_and_update", "accept_this_only", "refuse"]).optional(),
  reason: z.string().max(500).nullable().optional(),
});

export const receiveLineWithVariance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof ReceiveWithVarianceZ>) => ReceiveWithVarianceZ.parse(i))
  .handler(async ({ data, context }) => {
    // Load line + PO + settings
    const { data: line, error: eL } = await context.supabase.from("purchase_order_lines")
      .select("id,shop_id,unit_price_cents,item_id,purchase_order_id,name,stock_item_supplier_id")
      .eq("id", data.lineId).eq("shop_id", data.shopId).maybeSingle();
    if (eL) throw new Error(eL.message);
    if (!line) throw new Error("Ligne introuvable");

    const { data: po } = await context.supabase.from("purchase_orders")
      .select("id,supplier_id").eq("id", line.purchase_order_id).maybeSingle();
    if (!po) throw new Error("Bon introuvable");

    const { data: settings } = await context.supabase.from("shop_billing_settings")
      .select("purchase_price_variance_warning_pct,purchase_price_variance_warning_cents,purchase_price_variance_require_manager")
      .eq("shop_id", data.shopId).maybeSingle();
    const pctThresh = Number((settings as any)?.purchase_price_variance_warning_pct ?? 5);
    const centsThresh = Number((settings as any)?.purchase_price_variance_warning_cents ?? 500);

    const ordered = Number(line.unit_price_cents);
    const actual = data.actualUnitPriceCents != null ? Number(data.actualUnitPriceCents) : ordered;
    const diffCents = actual - ordered;
    const diffPct = ordered > 0 ? Math.abs(diffCents) / ordered * 100 : 0;
    const overThreshold = ordered > 0 && (Math.abs(diffCents) >= centsThresh || diffPct >= pctThresh);

    const decision = data.decision ?? "none";
    // If real variance exists, decision is mandatory
    if (actual !== ordered && decision === "none") {
      throw new Error(`Écart de prix détecté (${diffCents > 0 ? "+" : ""}${(diffCents / 100).toFixed(2)} € / ${(diffPct).toFixed(1)} %) — une décision est requise`);
    }
    if (overThreshold && decision !== "refuse" && !data.reason) {
      throw new Error("Un motif est requis pour valider un écart supérieur au seuil");
    }

    // Determine final price used for this reception:
    // - refuse or none-with-equal → keep ordered
    // - accept_and_update / accept_this_only → use actual
    const useActual = decision === "accept_and_update" || decision === "accept_this_only";
    const finalPrice = useActual ? actual : ordered;

    // Snapshot original SIS price if we might restore it (accept_this_only)
    let originalSisPriceCents: number | null = null;
    if (decision === "accept_this_only" && line.stock_item_supplier_id) {
      const { data: sisRow } = await context.supabase.from("stock_item_suppliers")
        .select("purchase_price_cents").eq("id", line.stock_item_supplier_id).maybeSingle();
      originalSisPriceCents = (sisRow as any)?.purchase_price_cents ?? null;
    }

    // If price differs, update line first so RPC uses correct price for history/upsert
    if (finalPrice !== ordered) {
      const { error: eU } = await context.supabase.from("purchase_order_lines")
        .update({ unit_price_cents: finalPrice }).eq("id", data.lineId).eq("shop_id", data.shopId);
      if (eU) throw new Error(eU.message);
    }

    // Receive
    const { error: eR } = await context.supabase.rpc("receive_purchase_order_line", {
      _shop_id: data.shopId, _line_id: data.lineId,
      _quantity: data.quantity,
      _note: data.note ?? undefined,
      _damaged: data.damaged ?? 0,
      _delivery_note: data.deliveryNote ?? undefined,
    });
    if (eR) throw new Error(eR.message);

    // If accept_this_only: revert SIS price and add explanatory history row
    if (decision === "accept_this_only" && line.stock_item_supplier_id && originalSisPriceCents != null && originalSisPriceCents !== finalPrice) {
      await context.supabase.from("stock_item_suppliers")
        .update({ purchase_price_cents: originalSisPriceCents }).eq("id", line.stock_item_supplier_id);
    }

    // Audit trail: log decision on history if variance existed
    if (finalPrice !== ordered || decision === "refuse") {
      await context.supabase.from("stock_purchase_price_history").insert({
        shop_id: data.shopId,
        stock_item_id: line.item_id,
        supplier_id: po.supplier_id,
        old_price_cents: ordered,
        new_price_cents: actual,
        source: "po_receive_variance",
        purchase_order_id: line.purchase_order_id,
        changed_by: context.userId,
        decision,
        reason: data.reason ?? null,
      } as any);
    }

    return { ok: true, diffCents, diffPct, overThreshold, decision };
  });