// Public (unauthenticated) server functions for shop storefront (services + products).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit.server";

const uuid = z.string().uuid();

export const publicGetShopStorefront = createServerFn({ method: "GET" })
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "public_read", shopId: data.shopId });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const shopRes = await supabaseAdmin
      .from("shops")
      .select("id, name, public_name, description, public_description, city, address, postal_code, phone, email, public_email, website, status, public_profile_status, public_logo_url, cover_image_url, gallery_images, social_links, theme_primary_color, theme_accent_color, business_type, verification_status, service_radius_km, covered_cities, covered_postal_codes, travel_fee_policy, travel_fee_amount_cents")
      .eq("id", data.shopId)
      .eq("status", "validated")
      .eq("public_profile_status", "published")
      .maybeSingle();
    if (!shopRes.data) return null;

    // Confidentialité : masquer l'adresse administrative pour les indépendants à domicile.
    if (shopRes.data.business_type === "mobile_independent") {
      shopRes.data.address = null;
      shopRes.data.postal_code = null;
      shopRes.data.city = null;
    }
    const verified = shopRes.data.verification_status === "verified";


    const [servicesRes, productsRes, hoursRes, paymentsRes] = await Promise.all([
      supabaseAdmin
        .from("service_catalog")
        .select("id, name, description, category, estimated_duration_minutes, unit_price_cents, tax_rate, line_type")
        .eq("shop_id", data.shopId)
        .eq("active", true)
        .is("archived_at", null)
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("stock_items")
        .select("id, name, description, category, brand, sku, sell_price_cents, tax_rate, quantity, reserved_quantity, quarantine_quantity, unit, item_type")
        .eq("shop_id", data.shopId)
        .eq("active", true)
        .is("archived_at", null)
        .gt("sell_price_cents", 0)
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabaseAdmin
        .from("shop_business_hours")
        .select("day_of_week, opens_at, closes_at, is_closed, break_start, break_end")
        .eq("shop_id", data.shopId)
        .order("day_of_week", { ascending: true }),
      supabaseAdmin.rpc("public_get_shop_payment_methods", { _shop_id: data.shopId }),
    ]);

    const services = (servicesRes.data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      line_type: s.line_type,
      estimated_duration_minutes: s.estimated_duration_minutes,
      price_ttc_cents: Math.round(Number(s.unit_price_cents ?? 0) * (1 + Number(s.tax_rate ?? 0) / 100)),
    }));

    const products = (productsRes.data ?? []).map((p: any) => {
      // Exclude reserved AND quarantine from public availability
      const available = Math.max(
        0,
        Number(p.quantity ?? 0) - Number(p.reserved_quantity ?? 0) - Number(p.quarantine_quantity ?? 0),
      );
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        brand: p.brand,
        sku: p.sku,
        unit: p.unit,
        item_type: p.item_type,
        available,
        in_stock: available > 0,
        price_ttc_cents: Math.round(Number(p.sell_price_cents ?? 0) * (1 + Number(p.tax_rate ?? 0) / 100)),
      };
    });

    const hours = (hoursRes.data ?? []).map((h: any) => ({
      day_of_week: h.day_of_week,
      opens_at: h.opens_at,
      closes_at: h.closes_at,
      is_closed: h.is_closed,
      break_start: h.break_start,
      break_end: h.break_end,
    }));

    // Payment methods: only accepts_* booleans + prep delay. NEVER includes IBAN/BIC/account holder.
    const pmRaw = (paymentsRes as { data: Record<string, unknown> | null }).data;
    const payment_methods = pmRaw ? {
      card_in_store: !!pmRaw.accepts_card_in_store,
      cash: !!pmRaw.accepts_cash,
      payment_on_pickup: !!pmRaw.accepts_payment_on_pickup,
      bank_transfer: !!pmRaw.accepts_bank_transfer,
      cheque: !!pmRaw.accepts_cheque,
      manual: !!pmRaw.accepts_manual_payment,
      preparation_delay: (pmRaw.payment_preparation_delay as string | null) ?? null,
    } : null;

    return { shop: shopRes.data, verified, services, products, hours, payment_methods };
  });

// Public directory: list verified/published shops (independents + boutiques).
export const publicListDirectory = createServerFn({ method: "GET" })
  .inputValidator((i: { businessType?: "physical_shop" | "mobile_independent"; query?: string; city?: string }) =>
    z.object({
      businessType: z.enum(["physical_shop", "mobile_independent"]).optional(),
      query: z.string().max(120).optional(),
      city: z.string().max(120).optional(),
    }).parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "public_read" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("shops")
      .select("id, public_name, name, public_description, description, city, public_logo_url, cover_image_url, business_type, verification_status, covered_cities, covered_postal_codes, service_radius_km")
      .eq("status", "validated")
      .eq("public_profile_status", "published")
      .order("verification_status", { ascending: false })
      .order("public_name", { ascending: true })
      .limit(200);
    if (data.businessType) q = q.eq("business_type", data.businessType);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const search = (data.query ?? "").trim().toLowerCase();
    const cityF = (data.city ?? "").trim().toLowerCase();
    return (rows ?? [])
      .map((s: any) => {
        // Mask administrative address/city for mobile independents.
        const isIndep = s.business_type === "mobile_independent";
        return {
          id: s.id,
          name: s.public_name || s.name,
          description: s.public_description || s.description || null,
          city: isIndep ? null : s.city,
          logo_url: s.public_logo_url,
          cover_url: s.cover_image_url,
          business_type: s.business_type,
          verified: s.verification_status === "verified",
          covered_cities: isIndep ? (s.covered_cities ?? []) : [],
          service_radius_km: isIndep ? s.service_radius_km : null,
        };
      })
      .filter((s) => {
        if (search && !`${s.name ?? ""} ${s.description ?? ""}`.toLowerCase().includes(search)) return false;
        if (cityF) {
          const inCity = (s.city ?? "").toLowerCase().includes(cityF);
          const inCovered = (s.covered_cities ?? []).some((c: string) => c.toLowerCase().includes(cityF));
          if (!inCity && !inCovered) return false;
        }
        return true;
      });
  });