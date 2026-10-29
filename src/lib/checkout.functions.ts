import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---------- Settings ----------
export const getCheckoutSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .rpc("ensure_checkout_settings", { _shop_id: data.shopId });
    if (error) throw new Error(error.message);
    return row as any;
  });

export const updateCheckoutSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; patch: Record<string, unknown> }) =>
    z.object({ shopId: uuid, patch: z.record(z.string(), z.unknown()) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("shop_checkout_settings")
      .update(data.patch as any)
      .eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Sale drafts ----------
export const createSaleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string;
    source?: "counter" | "order" | "repair" | "quote";
    customerId?: string;
    idempotencyKey?: string;
    linkedOrderId?: string;
    linkedRepairId?: string;
    linkedQuoteId?: string;
  }) => z.object({
    shopId: uuid,
    source: z.enum(["counter","order","repair","quote"]).optional(),
    customerId: uuid.optional(),
    idempotencyKey: z.string().min(1).max(120).optional(),
    linkedOrderId: uuid.optional(),
    linkedRepairId: uuid.optional(),
    linkedQuoteId: uuid.optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("create_sale_draft", {
      _shop_id: data.shopId,
      _source: data.source ?? "counter",
      _customer_id: data.customerId ?? null,
      _idempotency_key: data.idempotencyKey ?? null,
      _linked_order_id: data.linkedOrderId ?? null,
      _linked_repair_id: data.linkedRepairId ?? null,
      _linked_quote_id: data.linkedQuoteId ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return id as string;
  });

export const getSale = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { saleId: string }) => z.object({ saleId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: sale, error } = await context.supabase
      .from("sales").select("*").eq("id", data.saleId).maybeSingle();
    if (error) throw new Error(error.message);
    const { data: lines, error: e2 } = await context.supabase
      .from("sale_lines").select("*").eq("sale_id", data.saleId).order("display_order");
    if (e2) throw new Error(e2.message);
    return { sale, lines: lines ?? [] };
  });

export const addSaleLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    saleId: string;
    lineType: "product" | "service" | "free";
    stockItemId?: string;
    serviceCatalogId?: string;
    quantity?: number;
    customName?: string;
    customPriceCents?: number;
    customTaxRate?: number;
    discountPercent?: number;
    note?: string;
    repairId?: string;
  }) => z.object({
    saleId: uuid,
    lineType: z.enum(["product","service","free"]),
    stockItemId: uuid.optional(),
    serviceCatalogId: uuid.optional(),
    quantity: z.number().positive().max(9999).optional(),
    customName: z.string().max(240).optional(),
    customPriceCents: z.number().int().min(0).max(100_000_000).optional(),
    customTaxRate: z.number().min(0).max(100).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    note: z.string().max(500).optional(),
    repairId: uuid.optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("add_sale_line", {
      _sale_id: data.saleId,
      _line_type: data.lineType,
      _stock_item_id: data.stockItemId ?? null,
      _service_catalog_id: data.serviceCatalogId ?? null,
      _quantity: data.quantity ?? 1,
      _custom_name: data.customName ?? null,
      _custom_price_cents: data.customPriceCents ?? null,
      _custom_tax_rate: data.customTaxRate ?? null,
      _discount_percent: data.discountPercent ?? 0,
      _note: data.note ?? null,
      _repair_id: data.repairId ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return id as string;
  });

export const updateSaleLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    lineId: string;
    quantity?: number;
    discountPercent?: number;
    unitPriceCents?: number;
    note?: string;
  }) => z.object({
    lineId: uuid,
    quantity: z.number().positive().max(9999).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    unitPriceCents: z.number().int().min(0).max(100_000_000).optional(),
    note: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("update_sale_line", {
      _line_id: data.lineId,
      _quantity: data.quantity ?? null,
      _discount_percent: data.discountPercent ?? null,
      _unit_price_cents: data.unitPriceCents ?? null,
      _note: data.note ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeSaleLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { lineId: string }) => z.object({ lineId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("remove_sale_line", { _line_id: data.lineId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSaleCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { saleId: string; customerId?: string }) =>
    z.object({ saleId: uuid, customerId: uuid.optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_sale_customer", {
      _sale_id: data.saleId, _customer_id: data.customerId ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelSaleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { saleId: string }) => z.object({ saleId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("cancel_sale_draft", { _sale_id: data.saleId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const quickCreateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; lastName: string; firstName?: string; phone?: string; email?: string;
  }) => z.object({
    shopId: uuid,
    lastName: z.string().trim().min(1).max(120),
    firstName: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().max(200).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const email = data.email && data.email.length > 0 ? data.email : null;
    const { data: id, error } = await context.supabase.rpc("quick_create_customer", {
      _shop_id: data.shopId,
      _last_name: data.lastName,
      _first_name: data.firstName ?? null,
      _phone: data.phone ?? null,
      _email: email,
    } as any);
    if (error) throw new Error(error.message);
    return id as string;
  });

export const confirmSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    saleId: string;
    payments: Array<{
      method: string;
      amount_cents: number;
      status?: string;
      reference?: string;
      terminal_id?: string;
      card_last4?: string;
      connector_type?: string;
      note?: string;
    }>;
    createDocument: "invoice" | "receipt" | "none";
    idempotencyKey?: string;
  }) => z.object({
    saleId: uuid,
    payments: z.array(z.object({
      method: z.enum(["cash","card_terminal","bank_transfer","cheque","online","pickup","manual_received","other"]),
      amount_cents: z.number().int().min(0).max(100_000_000),
      status: z.enum(["pending","confirmed","failed","cancelled","refunded","partially_refunded"]).optional(),
      reference: z.string().max(120).optional(),
      terminal_id: z.string().max(120).optional(),
      card_last4: z.string().regex(/^\d{4}$/).optional(),
      connector_type: z.string().max(60).optional(),
      note: z.string().max(500).optional(),
    })).min(0).max(10),
    createDocument: z.enum(["invoice","receipt","none"]),
    idempotencyKey: z.string().min(1).max(120).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("confirm_sale", {
      _sale_id: data.saleId,
      _payments: data.payments as any,
      _create_document: data.createDocument,
      _idempotency_key: data.idempotencyKey ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return res as {
      sale_id: string;
      invoice_id: string | null;
      invoice_number: string | null;
      receipt_number: string | null;
      amount_paid_cents: number;
      total_including_tax_cents: number;
    };
  });

// ---------- Search ----------
export const searchCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; q: string; limit?: number }) => z.object({
    shopId: uuid, q: z.string().trim().max(120), limit: z.number().int().min(1).max(50).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const limit = data.limit ?? 15;
    const q = data.q;
    if (!q) return { products: [], services: [] };
    const like = `%${q}%`;
    const [pRes, sRes] = await Promise.all([
      context.supabase.from("stock_items")
        .select("id, name, sku, barcode, sell_price_cents, tax_rate, quantity, unit, item_type, active")
        .eq("shop_id", data.shopId)
        .eq("active", true)
        .or(`name.ilike.${like},sku.ilike.${like},barcode.ilike.${like}`)
        .limit(limit),
      context.supabase.from("service_catalog")
        .select("id, name, description, price_cents, tax_rate, active")
        .eq("shop_id", data.shopId)
        .eq("active", true)
        .ilike("name", like)
        .limit(limit),
    ]);
    if (pRes.error) throw new Error(pRes.error.message);
    if (sRes.error) throw new Error(sRes.error.message);
    return { products: pRes.data ?? [], services: sRes.data ?? [] };
  });

export const searchCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; q: string; limit?: number }) => z.object({
    shopId: uuid, q: z.string().trim().max(120), limit: z.number().int().min(1).max(50).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const limit = data.limit ?? 10;
    const q = data.q;
    if (!q) return [];
    const like = `%${q}%`;
    const { data: rows, error } = await context.supabase.from("customers")
      .select("id, first_name, last_name, company_name, email, phone")
      .eq("shop_id", data.shopId)
      .is("archived_at", null)
      .or(`last_name.ilike.${like},first_name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
      .limit(limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listRecentSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; limit?: number }) => z.object({
    shopId: uuid, limit: z.number().int().min(1).max(50).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("sales")
      .select("id, sale_number, receipt_number, invoice_id, total_including_tax_cents, amount_paid_cents, status, customer_id, completed_at, created_at")
      .eq("shop_id", data.shopId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(data.limit ?? 10);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });