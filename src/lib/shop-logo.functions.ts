import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

/**
 * Renvoie une URL signée (courte durée) pour afficher le logo d'une boutique.
 * Lisible par tout membre de la boutique.
 */
export const getShopLogoSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; variant?: "light" | "dark" }) =>
    z.object({
      shopId: uuid,
      variant: z.enum(["light", "dark"]).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const variant = data.variant ?? "light";
    const { data: bs } = await context.supabase
      .from("shop_billing_settings")
      .select("logo_url")
      .eq("shop_id", data.shopId)
      .maybeSingle();
    const path = bs?.logo_url ?? null;
    if (!path || !path.startsWith(`${data.shopId}/`)) {
      return { url: null as string | null, variant };
    }
    const { data: signed } = await context.supabase.storage
      .from("shop-logos")
      .createSignedUrl(path, 60 * 10);
    return { url: signed?.signedUrl ?? null, variant };
  });

/**
 * Enregistre le chemin du logo (path dans le bucket shop-logos) dans les
 * paramètres de facturation. L'upload lui-même est fait côté client avec
 * l'utilisateur authentifié (RLS storage).
 */
export const setShopLogoPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; path: string | null }) =>
    z.object({
      shopId: uuid,
      path: z.string().max(300).nullable(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    if (data.path && !data.path.startsWith(`${data.shopId}/`)) {
      throw new Error("Chemin de logo invalide.");
    }
    // Vérifie que l'utilisateur est bien gérant/proprio de la boutique
    const { data: mem } = await context.supabase
      .from("shop_memberships")
      .select("role")
      .eq("shop_id", data.shopId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!mem || !["shop_manager", "network_owner"].includes(mem.role)) {
      throw new Error("Accès refusé.");
    }
    // upsert
    const { data: existing } = await context.supabase
      .from("shop_billing_settings")
      .select("shop_id")
      .eq("shop_id", data.shopId)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("shop_billing_settings")
        .update({ logo_url: data.path })
        .eq("shop_id", data.shopId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("shop_billing_settings")
        .insert({ shop_id: data.shopId, logo_url: data.path });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });