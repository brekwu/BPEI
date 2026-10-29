import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const listVerificationDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: docs, error } = await context.supabase
      .from("verification_documents")
      .select("*")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: shop } = await context.supabase
      .from("shops")
      .select("verification_status, verification_submitted_at, verification_reviewed_at, verification_notes, business_type")
      .eq("id", data.shopId)
      .maybeSingle();
    return { documents: docs ?? [], shop };
  });

export const getVerificationDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { documentId: string }) =>
    z.object({ documentId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("verification_documents")
      .select("storage_path, shop_id")
      .eq("id", data.documentId)
      .maybeSingle();
    if (error || !doc) throw new Error("Document introuvable");
    const { data: signed, error: e2 } = await context.supabase.storage
      .from("shop-verification")
      .createSignedUrl(doc.storage_path, 300);
    if (e2 || !signed) throw new Error(e2?.message ?? "URL indisponible");
    return { url: signed.signedUrl };
  });

export const submitVerificationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; notes?: string }) =>
    z.object({ shopId: uuid, notes: z.string().max(2000).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("submit_verification_request", {
      _shop_id: data.shopId, _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVerificationDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { documentId: string }) =>
    z.object({ documentId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: doc } = await context.supabase
      .from("verification_documents")
      .select("storage_path")
      .eq("id", data.documentId)
      .maybeSingle();
    if (doc?.storage_path) {
      await context.supabase.storage.from("shop-verification").remove([doc.storage_path]);
    }
    const { error } = await context.supabase
      .from("verification_documents").delete().eq("id", data.documentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Owner console
export const ownerListPendingVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_platform_roles").select("role").eq("user_id", context.userId);
    const set = new Set((roles ?? []).map((r) => r.role));
    if (!set.has("owner_bpei") && !set.has("admin_bpei")) throw new Error("Accès refusé");
    const { data, error } = await context.supabase
      .from("shops")
      .select("id, name, public_name, business_type, verification_status, verification_submitted_at, verification_notes, city, email, phone")
      .in("verification_status", ["pending", "verified", "rejected", "suspended"])
      .order("verification_submitted_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const ownerReviewVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; decision: "verified" | "rejected" | "suspended" | "reset"; notes?: string }) =>
    z.object({
      shopId: uuid,
      decision: z.enum(["verified", "rejected", "suspended", "reset"]),
      notes: z.string().max(2000).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("owner_review_verification", {
      _shop_id: data.shopId, _decision: data.decision, _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });