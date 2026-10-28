// Public cross-shop catalog: browse products and services across all validated shops.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit.server";

const Input = z.object({
  q: z.string().trim().max(120).optional().default(""),
  kind: z.enum(["all", "products", "services"]).optional().default("all"),
  category: z.string().trim().max(80).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  limit: z.number().int().min(1).max(120).optional().default(60),
});

export type CatalogProduct = {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_city: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  price_ttc_cents: number;
  available: number;
  in_stock: boolean;
};
export type CatalogService = {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_city: string | null;
  name: string;
  description: string | null;
  category: string | null;
  estimated_duration_minutes: number | null;
  price_ttc_cents: number;
};

export const publicBrowseCatalog = createServerFn({ method: "GET" })
  .inputValidator((i: z.input<typeof Input>) => Input.parse(i))
  .handler(async ({ data }): Promise<{
    products: CatalogProduct[];
    services: CatalogService[];
    productCategories: string[];
    serviceCategories: string[];
    cities: string[];
  }> => {
    await enforceRateLimit({ endpoint: "public_read" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: shops } = await supabaseAdmin
      .from("shops")
      .select("id, name, city")
      .eq("status", "validated")
      .limit(500);
    const shopMap = new Map<string, { name: string; city: string | null }>();
    const cities = new Set<string>();
    for (const s of shops ?? []) {
      shopMap.set(s.id, { name: s.name, city: s.city });
      if (s.city) cities.add(s.city);
    }
    if (shopMap.size === 0) {
      return { products: [], services: [], productCategories: [], serviceCategories: [], cities: [] };
    }

    let shopIds = Array.from(shopMap.keys());
    if (data.city) {
      shopIds = shopIds.filter((id) => (shopMap.get(id)?.city ?? "").toLowerCase() === data.city.toLowerCase());
    }
    if (shopIds.length === 0) {
      return { products: [], services: [], productCategories: [], serviceCategories: [], cities: Array.from(cities).sort() };
    }

    const like = data.q ? `%${data.q.replace(/[%_]/g, "\\$&")}%` : null;

    const wantProducts = data.kind === "all" || data.kind === "products";
    const wantServices = data.kind === "all" || data.kind === "services";

    const [prodRes, svcRes] = await Promise.all([
      wantProducts
        ? (() => {
            let qb = supabaseAdmin
              .from("stock_items")
              .select("id, shop_id, name, description, brand, category, sell_price_cents, tax_rate, quantity, reserved_quantity, quarantine_quantity")
              .in("shop_id", shopIds)
              .eq("active", true)
              .is("archived_at", null)
              .gt("sell_price_cents", 0);
            if (like) qb = qb.or(`name.ilike.${like},description.ilike.${like},brand.ilike.${like},category.ilike.${like},sku.ilike.${like}`);
            if (data.category) qb = qb.eq("category", data.category);
            return qb.order("name").limit(data.limit);
          })()
        : Promise.resolve({ data: [] as any[] }),
      wantServices
        ? (() => {
            let qb = supabaseAdmin
              .from("service_catalog")
              .select("id, shop_id, name, description, category, estimated_duration_minutes, unit_price_cents, tax_rate")
              .in("shop_id", shopIds)
              .eq("active", true)
              .is("archived_at", null);
            if (like) qb = qb.or(`name.ilike.${like},description.ilike.${like},category.ilike.${like}`);
            if (data.category) qb = qb.eq("category", data.category);
            return qb.order("name").limit(data.limit);
          })()
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const productCategories = new Set<string>();
    const products: CatalogProduct[] = (prodRes.data ?? []).map((p: any) => {
      if (p.category) productCategories.add(p.category);
      const shop = shopMap.get(p.shop_id)!;
      const avail = Math.max(0, Number(p.quantity ?? 0) - Number(p.reserved_quantity ?? 0) - Number(p.quarantine_quantity ?? 0));
      return {
        id: p.id,
        shop_id: p.shop_id,
        shop_name: shop.name,
        shop_city: shop.city,
        name: p.name,
        description: p.description,
        brand: p.brand,
        category: p.category,
        price_ttc_cents: Math.round(Number(p.sell_price_cents ?? 0) * (1 + Number(p.tax_rate ?? 0) / 100)),
        available: avail,
        in_stock: avail > 0,
      };
    });

    const serviceCategories = new Set<string>();
    const services: CatalogService[] = (svcRes.data ?? []).map((s: any) => {
      if (s.category) serviceCategories.add(s.category);
      const shop = shopMap.get(s.shop_id)!;
      return {
        id: s.id,
        shop_id: s.shop_id,
        shop_name: shop.name,
        shop_city: shop.city,
        name: s.name,
        description: s.description,
        category: s.category,
        estimated_duration_minutes: s.estimated_duration_minutes,
        price_ttc_cents: Math.round(Number(s.unit_price_cents ?? 0) * (1 + Number(s.tax_rate ?? 0) / 100)),
      };
    });

    return {
      products,
      services,
      productCategories: Array.from(productCategories).sort(),
      serviceCategories: Array.from(serviceCategories).sort(),
      cities: Array.from(cities).sort(),
    };
  });