import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ShopIdIn = z.object({ shopId: z.string().uuid() });

export const listCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; includeArchived?: boolean }) =>
    z.object({ shopId: z.string().uuid(), includeArchived: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("service_catalog").select("*").eq("shop_id", data.shopId);
    if (!data.includeArchived) q = q.is("archived_at", null);
    const { data: rows, error } = await q.order("category", { ascending: true }).order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CatalogUpsert = z.object({
  shopId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  line_type: z.enum(["service", "product", "labour", "discount", "other"]),
  internal_reference: z.string().max(100).nullable().optional(),
  default_quantity: z.number().min(0).default(1),
  unit: z.string().max(30).default("unité"),
  unit_price_cents: z.number().int().min(0),
  tax_rate: z.number().min(0).max(100),
  estimated_duration_minutes: z.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
});

export const upsertCatalogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof CatalogUpsert>) => CatalogUpsert.parse(i))
  .handler(async ({ data, context }) => {
    const { shopId, id, ...fields } = data;
    if (id) {
      const { data: row, error } = await context.supabase.from("service_catalog")
        .update(fields).eq("id", id).eq("shop_id", shopId).select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase.from("service_catalog")
      .insert({ ...fields, shop_id: shopId, created_by: context.userId })
      .select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const archiveCatalogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string; restore?: boolean }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid(), restore: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("service_catalog")
      .update({ archived_at: data.restore ? null : new Date().toISOString() })
      .eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateCatalogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: src, error: e1 } = await context.supabase.from("service_catalog")
      .select("*").eq("id", data.id).eq("shop_id", data.shopId).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!src) throw new Error("introuvable");
    const { id, created_at, updated_at, archived_at, ...rest } = src as any;
    const { data: row, error } = await context.supabase.from("service_catalog")
      .insert({ ...rest, name: `${src.name} (copie)`, created_by: context.userId })
      .select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCatalogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; id: string }) =>
    z.object({ shopId: z.string().uuid(), id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // On refuse la suppression si l'item est référencé sur des devis ou factures.
    const [q, i] = await Promise.all([
      context.supabase.from("quote_lines").select("id", { count: "exact", head: true }).eq("catalog_item_id", data.id),
      context.supabase.from("invoice_lines").select("id", { count: "exact", head: true }).eq("catalog_item_id", data.id),
    ]);
    const used = (q.count ?? 0) + (i.count ?? 0);
    if (used > 0) throw new Error("Impossible : cet article est utilisé sur des devis ou factures. Archivez-le à la place.");
    const { error } = await context.supabase.from("service_catalog")
      .delete().eq("id", data.id).eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const catalogStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => ShopIdIn.parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("service_catalog")
      .select("line_type, active, archived_at, category").eq("shop_id", data.shopId);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const active = list.filter((r) => r.active && !r.archived_at).length;
    const archived = list.filter((r) => !!r.archived_at).length;
    const inactive = list.filter((r) => !r.active && !r.archived_at).length;
    const byType: Record<string, number> = {};
    const categories = new Set<string>();
    for (const r of list) {
      if (r.archived_at) continue;
      byType[r.line_type] = (byType[r.line_type] ?? 0) + 1;
      if (r.category) categories.add(r.category);
    }
    return { total: list.length, active, inactive, archived, byType, categories: Array.from(categories).sort() };
  });