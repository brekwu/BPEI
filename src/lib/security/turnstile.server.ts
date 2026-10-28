// Server-only: Cloudflare Turnstile verification.
// - Toujours vérifié côté serveur.
// - En production, aucune clé absente n'est tolérée : refus explicite.
// - En dev/preview, absence de clé => bypass avec log d'avertissement.

export interface TurnstileResult {
  success: boolean;
  errorCodes?: string[];
  bypass?: boolean;
}

function isProduction(): boolean {
  // NODE_ENV est "production" pour la build déployée (worker) et
  // "development" pour vite dev / preview HMR local.
  return process.env.NODE_ENV === "production";
}

export function turnstileConfigured(): boolean {
  return !!(process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SITE_KEY);
}

export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const site = process.env.TURNSTILE_SITE_KEY;
  const prod = isProduction();

  if (!secret || !site) {
    if (prod) {
      console.error(
        "[turnstile] PRODUCTION: TURNSTILE_SECRET_KEY ou TURNSTILE_SITE_KEY absente — action refusée.",
      );
      return { success: false, errorCodes: ["configuration-missing"] };
    }
    console.warn(
      "[turnstile] DEV/PREVIEW: clés Turnstile absentes — bypass (jamais en production).",
    );
    return { success: true, bypass: true };
  }

  if (!token || token.length < 10) {
    return { success: false, errorCodes: ["missing-input-response"] };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      },
    );
    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };
    if (!data.success) {
      console.warn("[turnstile] verify failed", data["error-codes"]);
    }
    return { success: !!data.success, errorCodes: data["error-codes"] };
  } catch (err) {
    console.error("[turnstile] verify error", err);
    // En production on refuse plutôt que de laisser passer sur erreur réseau.
    return { success: !prod, errorCodes: ["internal-error"] };
  }
}