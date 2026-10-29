import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const KINDS = ["logo", "cover", "favicon", "social"] as const;

export const setShopMediaPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; kind: (typeof KINDS)[number]; path: string | null }) =>
    z.object({ shopId: uuid, kind: z.enum(KINDS), path: z.string().max(300).nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    // Server-side guard: reject empty / zero-byte uploads before persisting the reference.
    if (data.path) {
      const { data: signed, error: signErr } = await context.supabase.storage
        .from("shop-public-media")
        .createSignedUrl(data.path, 60);
      if (signErr || !signed?.signedUrl) throw new Error("Fichier introuvable dans le stockage.");
      const head = await fetch(signed.signedUrl, { method: "HEAD" });
      const len = Number(head.headers.get("content-length") ?? "0");
      if (!head.ok || !Number.isFinite(len) || len <= 0) {
        await context.supabase.storage.from("shop-public-media").remove([data.path]);
        throw new Error("Le fichier est vide. Sélectionnez un fichier valide.");
      }
    }
    const { error } = await context.supabase.rpc("set_shop_media", {
      _shop_id: data.shopId, _kind: data.kind, _path: data.path as unknown as string,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const appendShopGallery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; path: string; alt?: string }) =>
    z.object({ shopId: uuid, path: z.string().max(300), alt: z.string().max(160).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("append_shop_gallery", {
      _shop_id: data.shopId, _path: data.path, _alt: (data.alt ?? null) as unknown as string,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeShopGallery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; path: string }) =>
    z.object({ shopId: uuid, path: z.string().max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("remove_shop_gallery", {
      _shop_id: data.shopId, _path: data.path,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// URL signée pour affichage (bucket privé)
export const getShopMediaSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { path: string }) =>
    z.object({ path: z.string().max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: signed } = await context.supabase.storage
      .from("shop-public-media")
      .createSignedUrl(data.path, 60 * 10);
    return { url: signed?.signedUrl ?? null };
  });