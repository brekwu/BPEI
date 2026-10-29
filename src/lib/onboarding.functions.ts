import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: shop, error } = await context.supabase
      .from("shops")
      .select("id, name, public_name, onboarding_status, onboarding_current_step, onboarding_data, onboarding_completed_at, phone, email, address, city, postal_code, description, public_logo_url, cover_image_url")
      .eq("id", data.shopId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!shop) throw new Error("Boutique introuvable");
    const { count: servicesCount } = await context.supabase
      .from("service_catalog").select("id", { count: "exact", head: true })
      .eq("shop_id", data.shopId).eq("active", true);
    const { count: stockCount } = await context.supabase
      .from("stock_items").select("id", { count: "exact", head: true })
      .eq("shop_id", data.shopId);
    return { shop, servicesCount: servicesCount ?? 0, stockCount: stockCount ?? 0 };
  });

export const saveOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; step: string; data: Record<string, unknown> }) =>
    z.object({ shopId: uuid, step: z.string().min(1).max(40), data: z.record(z.any()) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("onboarding_save_step", {
      _shop_id: data.shopId, _step: data.step, _data: data.data,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("onboarding_complete", { _shop_id: data.shopId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const skipOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; step: string }) =>
    z.object({ shopId: uuid, step: z.string().min(1).max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("onboarding_skip_optional", {
      _shop_id: data.shopId, _step: data.step,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Sauvegarde des champs identité + contact directement dans shops
export const saveShopIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string;
    public_name?: string | null;
    description?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    postal_code?: string | null;
  }) => z.object({
    shopId: uuid,
    public_name: z.string().max(120).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    email: z.string().email().max(160).nullable().optional(),
    address: z.string().max(200).nullable().optional(),
    city: z.string().max(120).nullable().optional(),
    postal_code: z.string().max(20).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { shopId, ...patch } = data;
    // Contrôle rôle : le membership doit être shop_manager/network_owner
    const { data: mem } = await context.supabase
      .from("shop_memberships").select("role").eq("shop_id", shopId).eq("user_id", context.userId).maybeSingle();
    if (!mem || !["shop_manager", "network_owner"].includes(mem.role)) throw new Error("Accès refusé");
    const { error } = await context.supabase.from("shops").update(patch).eq("id", shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Invitations robustes
export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("owner_revoke_invitation", { _id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: tok, error } = await context.supabase.rpc("owner_resend_invitation", { _id: data.id });
    if (error) throw new Error(error.message);
    return { token: tok as string };
  });

export const changeInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; email: string }) =>
    z.object({ id: uuid, email: z.string().email().max(160) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("owner_change_invitation_email", {
      _id: data.id, _new_email: data.email,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });