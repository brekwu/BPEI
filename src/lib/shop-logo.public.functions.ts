// URL signée courte pour affichage public du logo boutique (fiche publique,
// page de réservation, suivi QR, avis, portail client sans auth).
// Bucket privé : on n'expose jamais un chemin brut ni une URL signée longue.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function serviceRoleClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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

export const publicGetShopLogoUrl = createServerFn({ method: "GET" })
  .inputValidator((i: { shopId: string }) =>
    z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supa = await serviceRoleClient();
    // Ne renvoyer un logo que si la boutique est validée (pas de fuite prématurée).
    const { data: shop } = await supa
      .from("shops")
      .select("id, status")
      .eq("id", data.shopId)
      .maybeSingle();
    if (!shop || shop.status !== "validated") return { url: null as string | null };
    const { data: bs } = await supa
      .from("shop_billing_settings")
      .select("logo_url")
      .eq("shop_id", data.shopId)
      .maybeSingle();
    const path = bs?.logo_url ?? null;
    if (!path || !path.startsWith(`${data.shopId}/`)) return { url: null };
    const { data: signed } = await supa.storage
      .from("shop-logos")
      .createSignedUrl(path, 60 * 10); // 10 minutes
    return { url: signed?.signedUrl ?? null };
  });