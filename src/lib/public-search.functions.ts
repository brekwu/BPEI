// Public server-side search across validated shops, their services and products.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit.server";

const Input = z.object({
  q: z.string().trim().max(120).optional().default(""),
  limit: z.number().int().min(1).max(60).optional().default(30),
});

export type SearchShopResult = {
  id: string;
  name: string;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  matched_services: { id: string; name: string; category: string | null }[];
  matched_products: { id: string; name: string; brand: string | null; category: string | null }[];
  match_reason: "name" | "city" | "postal" | "service" | "product" | "all";
};

export const publicSearchShops = createServerFn({ method: "GET" })
  .inputValidator((i: z.input<typeof Input>) => Input.parse(i))
  .handler(async ({ data }): Promise<SearchShopResult[]> => {
    await enforceRateLimit({ endpoint: "public_read" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = (data.q ?? "").trim();

    // Base: all validated shops (no draft/pending/suspended leaked to public)
    const shopSel = supabaseAdmin
      .from("shops")
      .select("id, name, city, postal_code, address, phone, description")
      .eq("status", "validated")
      .order("name")
      .limit(200);
    const { data: allShops } = await shopSel;
    const shops = allShops ?? [];
    if (!q) {
      return shops.slice(0, data.limit).map((s: any) => ({
        ...s,
        matched_services: [],
        matched_products: [],
        match_reason: "all" as const,
      }));
    }

    const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const nameMatch = new Set<string>();
    const cityMatch = new Set<string>();
    const postalMatch = new Set<string>();
    const isPostalLike = /^\d{2,5}$/.test(q);

    for (const s of shops) {
      const hay = (s.name ?? "").toLowerCase();
      if (hay.includes(q.toLowerCase())) nameMatch.add(s.id);
      if ((s.city ?? "").toLowerCase().includes(q.toLowerCase())) cityMatch.add(s.id);
      if (isPostalLike && (s.postal_code ?? "").startsWith(q)) postalMatch.add(s.id);
    }

    // Search services and products across ALL validated shops (bounded)
    const shopIds = shops.map((s: any) => s.id);
    if (shopIds.length === 0) return [];

    const [svcRes, prodRes] = await Promise.all([
      supabaseAdmin
        .from("service_catalog")
        .select("id, shop_id, name, category")
        .eq("active", true)
        .is("archived_at", null)
        .in("shop_id", shopIds)
        .or(`name.ilike.${like},description.ilike.${like},category.ilike.${like}`)
        .limit(300),
      supabaseAdmin
        .from("stock_items")
        .select("id, shop_id, name, brand, category")
        .eq("active", true)
        .is("archived_at", null)
        .in("shop_id", shopIds)
        .or(`name.ilike.${like},description.ilike.${like},brand.ilike.${like},category.ilike.${like},sku.ilike.${like}`)
        .limit(300),
    ]);

    const svcByShop = new Map<string, { id: string; name: string; category: string | null }[]>();
    for (const s of svcRes.data ?? []) {
      const arr = svcByShop.get(s.shop_id) ?? [];
      arr.push({ id: s.id, name: s.name, category: s.category });
      svcByShop.set(s.shop_id, arr);
    }
    const prodByShop = new Map<string, { id: string; name: string; brand: string | null; category: string | null }[]>();
    for (const p of prodRes.data ?? []) {
      const arr = prodByShop.get(p.shop_id) ?? [];
      arr.push({ id: p.id, name: p.name, brand: p.brand, category: p.category });
      prodByShop.set(p.shop_id, arr);
    }

    const matchedIds = new Set<string>([
      ...nameMatch, ...cityMatch, ...postalMatch,
      ...svcByShop.keys(), ...prodByShop.keys(),
    ]);

    const results: SearchShopResult[] = shops
      .filter((s: any) => matchedIds.has(s.id))
      .map((s: any) => {
        const svcs = svcByShop.get(s.id) ?? [];
        const prods = prodByShop.get(s.id) ?? [];
        let reason: SearchShopResult["match_reason"] = "all";
        if (nameMatch.has(s.id)) reason = "name";
        else if (postalMatch.has(s.id)) reason = "postal";
        else if (cityMatch.has(s.id)) reason = "city";
        else if (svcs.length) reason = "service";
        else if (prods.length) reason = "product";
        return {
          id: s.id,
          name: s.name,
          city: s.city,
          postal_code: s.postal_code,
          address: s.address,
          phone: s.phone,
          description: s.description,
          matched_services: svcs.slice(0, 3),
          matched_products: prods.slice(0, 3),
          match_reason: reason,
        };
      });

    // Ranking: name > postal > city > service > product
    const rank = { name: 0, postal: 1, city: 2, service: 3, product: 4, all: 5 } as const;
    results.sort((a, b) => (rank[a.match_reason] - rank[b.match_reason]) || a.name.localeCompare(b.name));
    return results.slice(0, data.limit);
  });