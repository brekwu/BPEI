import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
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

export const getPlatformLegalSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("platform_legal_settings").select("*").limit(1).maybeSingle();
  return data;
});

export const getPublishedDocument = createServerFn({ method: "GET" })
  .inputValidator((i: { code: string }) => z.object({ code: z.string().min(1).max(100) }).parse(i))
  .handler(async ({ data }) => {
    const { data: doc } = await publicClient()
      .from("legal_documents")
      .select("*")
      .eq("document_code", data.code)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return doc;
  });

export const upsertPlatformLegalSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: Record<string, unknown>) => i)
  .handler(async ({ data, context }) => {
    // authz check: must be owner or admin
    const { data: role } = await context.supabase
      .from("user_platform_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["owner_bpei", "admin_bpei"])
      .limit(1)
      .maybeSingle();
    if (!role) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data, singleton: true, updated_at: new Date().toISOString(), updated_by: context.userId };
    const { error } = await supabaseAdmin.from("platform_legal_settings").upsert(payload as any, { onConflict: "singleton" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitContentReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      category: z.string().min(1).max(50),
      target_type: z.string().max(50).optional(),
      target_id: z.string().max(200).optional(),
      target_url: z.string().max(500).optional(),
      target_shop_id: z.string().uuid().optional(),
      description: z.string().min(10).max(5000),
      legal_basis: z.string().max(500).optional(),
      reporter_name: z.string().max(200).optional(),
      reporter_email: z.string().email().max(255).optional(),
      reporter_phone: z.string().max(50).optional(),
      good_faith_declared: z.boolean(),
    }).parse(i))
  .handler(async ({ data }) => {
    if (!data.good_faith_declared) throw new Error("La déclaration de bonne foi est requise.");
    const { data: rows, error } = await publicClient().rpc("submit_public_content_report" as any, {
      p_category: data.category,
      p_description: data.description,
      p_target_type: data.target_type ?? null,
      p_target_id: data.target_id ?? null,
      p_target_url: data.target_url ?? null,
      p_target_shop_id: (data as any).target_shop_id ?? null,
      p_legal_basis: data.legal_basis ?? null,
      p_reporter_name: data.reporter_name ?? null,
      p_reporter_email: data.reporter_email ?? null,
      p_reporter_phone: data.reporter_phone ?? null,
      p_good_faith: data.good_faith_declared,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { report_number: (row as any)?.report_number as string };
  });

export const submitPrivacyRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      request_type: z.enum(["access","rectification","deletion","opposition","limitation","portability","other"]),
      requester_full_name: z.string().min(2).max(200),
      requester_email: z.string().email().max(255),
      description: z.string().max(3000).optional(),
    }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("privacy_requests")
      .insert(data as any)
      .select("request_number, due_date")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const recordCookieConsent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      pseudonym_id: z.string().min(4).max(100),
      policy_version: z.string().max(20),
      preferences: z.boolean(),
      analytics: z.boolean(),
      external_features: z.boolean(),
      advertising: z.boolean(),
    }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("cookie_consents").insert({ ...data, necessary: true } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordAcceptance = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      document_code: z.string().max(100),
      document_version: z.number().int().positive(),
      order_id: z.string().uuid().optional(),
      shop_id: z.string().uuid().optional(),
      guest_identifier: z.string().max(100).optional(),
    }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("legal_acceptances").insert({
      document_code: data.document_code,
      document_version: data.document_version,
      order_id: data.order_id,
      shop_id: data.shop_id,
      guest_identifier: data.guest_identifier,
      acceptance_type: "checkbox",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });