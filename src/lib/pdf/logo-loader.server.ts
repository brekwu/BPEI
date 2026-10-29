// Server-only helper: charge le logo d'une boutique (chemin stocké dans
// billing_identity_snapshot.settings.logo_url) et le renvoie en data URL,
// à inclure dans un PDF. Renvoie null si aucun logo n'est configuré ou si
// l'objet a été supprimé du bucket.
//
// IMPORTANT : on lit l'objet depuis le snapshot du document, pas depuis
// la configuration courante — un remplacement ultérieur du logo ne change
// donc pas les anciens PDF (l'objet précédent reste dans le bucket sous
// son nom d'origine tant qu'il n'a pas été explicitement remplacé).

export async function loadLogoDataUrl(
  logoPath: string | null | undefined,
): Promise<string | null> {
  if (!logoPath) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return null;
    const supa = createClient(process.env.SUPABASE_URL!, key, {
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
    const { data, error } = await supa.storage.from("shop-logos").download(logoPath);
    if (error || !data) return null;
    const buf = new Uint8Array(await data.arrayBuffer());
    const mime = data.type || (logoPath.endsWith(".png") ? "image/png"
      : logoPath.endsWith(".webp") ? "image/webp"
      : "image/jpeg");
    // Refuse SVG et tout type non image bitmap pour rester compatible
    // avec @react-pdf et éviter d'exécuter un fichier vecteur non nettoyé.
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) return null;
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const g = globalThis as any;
    const b64 = typeof g.btoa === "function"
      ? g.btoa(binary)
      : (g.Buffer as { from: (b: Uint8Array) => { toString: (fmt: string) => string } })
          .from(buf).toString("base64");
    return `data:${mime};base64,${b64}`;
  } catch (err) {
    console.error("[logo-loader] failed", err);
    return null;
  }
}