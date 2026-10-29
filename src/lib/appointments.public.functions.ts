// Public (unauthenticated) server functions for appointments, repair status and reviews.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/security/rate-limit.server";

async function serverPublicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
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

const uuid = z.string().uuid();

/* ============ SHOP PUBLIC INFO (for booking page) ============ */

export const publicGetShopBooking = createServerFn({ method: "GET" })
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "public_read", shopId: data.shopId });
    const supabase = await serverPublicClient();
    const [shopRes, hoursRes, servicesRes] = await Promise.all([
      supabase.from("shops_public").select("id, name, city, address, postal_code, phone, email, status")
        .eq("id", data.shopId).maybeSingle(),
      supabase.from("shop_business_hours").select("*").eq("shop_id", data.shopId).order("day_of_week"),
      supabase.from("service_catalog")
        .select("id, name, description, category, estimated_duration_minutes, unit_price_cents, tax_rate")
        .eq("shop_id", data.shopId).eq("active", true).order("name"),
    ]);
    if (!shopRes.data) return null;
    const services = (servicesRes.data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      estimated_duration_minutes: s.estimated_duration_minutes,
      price_ttc_cents: Math.round(Number(s.unit_price_cents ?? 0) * (1 + Number(s.tax_rate ?? 0) / 100)),
      currency: "EUR",
    }));
    return { shop: shopRes.data, hours: hoursRes.data ?? [], services };

  });

export const publicGetAvailableSlots = createServerFn({ method: "GET" })
  .inputValidator((i: { shopId: string; serviceId: string; from: string; to: string }) =>
    z.object({
      shopId: uuid, serviceId: uuid,
      from: z.string().datetime(), to: z.string().datetime(),
    }).parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "public_read", shopId: data.shopId });
    const supabase = await serverPublicClient();
    const { data: slots, error } = await supabase.rpc("get_available_slots", {
      _shop_id: data.shopId, _service_id: data.serviceId,
      _from: data.from, _to: data.to,
    });
    if (error) throw new Error(error.message);
    return (slots ?? []) as Array<{ starts_at: string; ends_at: string }>;
  });

export const publicBookAppointment = createServerFn({ method: "POST" })
  .inputValidator((i: {
    shopId: string; serviceId: string; startsAt: string;
    name: string; email?: string | null; phone: string;
    deviceDescription?: string | null; problemDescription?: string | null;
    turnstileToken?: string | null; fingerprint?: string | null;
  }) => z.object({
    shopId: uuid, serviceId: uuid,
    startsAt: z.string().datetime(),
    name: z.string().min(2).max(120),
    email: z.string().email().max(255).nullable().optional(),
    phone: z.string().min(4).max(40),
    deviceDescription: z.string().max(500).nullable().optional(),
    problemDescription: z.string().max(2000).nullable().optional(),
    turnstileToken: z.string().max(4000).nullable().optional(),
    fingerprint: z.string().max(200).nullable().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({
      endpoint: "book_appointment",
      shopId: data.shopId,
      fingerprint: data.fingerprint,
      turnstileToken: data.turnstileToken,
      requireTurnstile: true,
    });
    const supabase = await serverPublicClient();
    const { data: id, error } = await supabase.rpc("book_public_appointment", {
      _shop_id: data.shopId, _service_id: data.serviceId,
      _starts_at: data.startsAt, _name: data.name,
      _email: data.email ?? "", _phone: data.phone,
      _device_description: data.deviceDescription ?? "",
      _problem_description: data.problemDescription ?? "",
    });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

/* ============ REPAIR STATUS (QR code) ============ */

export const publicGetRepairStatus = createServerFn({ method: "GET" })
  .inputValidator((i: { token: string }) => z.object({ token: z.string().min(10).max(200) }).parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "public_read" });
    const supabase = await serverPublicClient();
    const { data: res, error } = await supabase.rpc("public_get_repair_status", { _token: data.token });
    if (error) throw new Error(error.message);
    return res as {
      repair: { id: string; repair_number: string; status: string; customer_visible_notes: string | null;
        estimated_completion_at: string | null; completed_at: string | null; collected_at: string | null;
        created_at: string; updated_at: string; customer_issue: string | null; technical_diagnosis: string | null };
      shop: { id: string; name: string; city: string | null; phone: string | null; email: string | null };
      history: Array<{ old_status: string | null; new_status: string; changed_at: string }>;
    } | null;
  });

/* ============ REVIEW CONTEXT (minimal, for /avis page) ============ */

/**
 * Retourne uniquement les infos publiques strictement nécessaires
 * pour l'en-tête et la validation d'éligibilité de la page d'avis.
 * Ne renvoie JAMAIS de PII client, ni diagnostic, ni notes.
 */
export const publicGetReviewContext = createServerFn({ method: "GET" })
  .inputValidator((i: { token: string }) =>
    z.object({ token: z.string().min(10).max(200) }).parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "public_read" });
    const supabase = await serverPublicClient();
    // Réutilise le RPC de suivi mais ne re-projette que les champs safe.
    const { data: res, error } = await supabase.rpc("public_get_repair_status", { _token: data.token });
    if (error) throw new Error(error.message);
    if (!res) return null;
    const r = res as {
      repair: { repair_number: string; status: string };
      shop: { id: string; name: string; city: string | null };
    };
    // Éligibilité minimale : réparation terminée ou récupérée
    const eligible = ["repair_completed", "device_collected", "closed"].includes(r.repair?.status ?? "");
    return {
      shop: { id: r.shop.id, name: r.shop.name, city: r.shop.city },
      repair_number: r.repair.repair_number,
      eligible,
    };
  });

/* ============ REVIEW SUBMISSION ============ */


export const publicSubmitReview = createServerFn({ method: "POST" })
  .inputValidator((i: {
    token: string; name: string; rating: number;
    title?: string | null; comment?: string | null;
    ratingQuality?: number | null; ratingSpeed?: number | null; ratingCommunication?: number | null;
    turnstileToken?: string | null; fingerprint?: string | null;
  }) =>
    z.object({
      token: z.string().min(10).max(200),
      name: z.string().min(2).max(120),
      rating: z.number().int().min(1).max(5),
      title: z.string().max(120).nullable().optional(),
      comment: z.string().max(2000).nullable().optional(),
      ratingQuality: z.number().int().min(1).max(5).nullable().optional(),
      ratingSpeed: z.number().int().min(1).max(5).nullable().optional(),
      ratingCommunication: z.number().int().min(1).max(5).nullable().optional(),
      turnstileToken: z.string().max(4000).nullable().optional(),
      fingerprint: z.string().max(200).nullable().optional(),
    }).parse(i))
  .handler(async ({ data }) => {
    const { ip } = await enforceRateLimit({
      endpoint: "submit_review",
      fingerprint: data.fingerprint,
      turnstileToken: data.turnstileToken,
      requireTurnstile: true,
    });
    const supabase = await serverPublicClient();
    const { data: id, error } = await supabase.rpc("submit_review", {
      _token: data.token, _author_name: data.name, _rating: data.rating,
      _title: data.title ?? "", _comment: data.comment ?? "",
      _ip: ip, _ua: null,
      _rating_quality: data.ratingQuality ?? null,
      _rating_speed: data.ratingSpeed ?? null,
      _rating_communication: data.ratingCommunication ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

/* ============ PUBLIC REVIEWS LIST ============ */

export const publicListShopReviews = createServerFn({ method: "GET" })
  .inputValidator((i: { shopId: string; limit?: number }) =>
    z.object({ shopId: uuid, limit: z.number().int().min(1).max(100).optional() }).parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "public_read", shopId: data.shopId });
    const supabase = await serverPublicClient();
    const [listRes, statsRes] = await Promise.all([
      supabase.rpc("list_shop_public_reviews", { _shop_id: data.shopId, _limit: data.limit ?? 20 }),
      supabase.rpc("get_shop_review_stats", { _shop_id: data.shopId }),
    ]);
    if (listRes.error) throw new Error(listRes.error.message);
    if (statsRes.error) throw new Error(statsRes.error.message);
    const stats = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
    return {
      reviews: (listRes.data ?? []) as Array<{
        id: string; author_name: string; rating: number; title: string | null; comment: string | null;
        rating_quality: number | null; rating_speed: number | null; rating_communication: number | null;
        reply_text: string | null; replied_at: string | null; published_at: string | null;
      }>,
      count: (stats?.review_count as number) ?? 0,
      average: stats?.avg_rating ? Number(stats.avg_rating) : null,
    };
  });