/**
 * Détermination fiable de l'environnement d'exécution (preview | production).
 *
 * Ordre de priorité :
 *   1. `process.env.BPEI_RUNTIME_ENV` (à définir par déploiement).
 *   2. Résolution stricte à partir du hostname réel de la requête (jamais du body,
 *      des query params ni de headers falsifiables côté client).
 *   3. Fail-closed : retourne `null` => module désactivé.
 *
 * Aucune information transmise par le navigateur n'est acceptée pour déterminer
 * l'environnement. Les seules sources fiables sont :
 *   - la variable d'environnement serveur du déploiement,
 *   - le `Host` HTTP reçu par le Worker (Cloudflare/TSS l'assigne d'après la
 *     requête TCP entrante, indépendamment de `x-forwarded-host` client).
 */

import { getRequest } from "@tanstack/react-start/server";

export type RuntimeEnvironment = "preview" | "production";

const PRODUCTION_HOSTS = new Set<string>([
  "bpei.fr",
  "www.bpei.fr",
  "pro-repair-connect.lovable.app",
  "project--2d1ac429-ce2c-45e9-bdc3-dffaa4747e4f.lovable.app",
]);

// Domaines Preview identifiés (Lovable id-preview, preview stable, éditeur).
const PREVIEW_HOST_SUFFIXES = [
  "id-preview--2d1ac429-ce2c-45e9-bdc3-dffaa4747e4f.lovable.app",
  "project--2d1ac429-ce2c-45e9-bdc3-dffaa4747e4f-dev.lovable.app",
  "2d1ac429-ce2c-45e9-bdc3-dffaa4747e4f.lovableproject.com",
];


function fromEnvVar(): RuntimeEnvironment | null {
  const v = (process.env.BPEI_RUNTIME_ENV ?? "").trim().toLowerCase();
  if (v === "preview" || v === "production") return v;
  return null;
}

// UUID projet BPEI — utilisé pour valider les hostnames Preview dynamiques.
const PROJECT_ID = "2d1ac429-ce2c-45e9-bdc3-dffaa4747e4f";

function fromRequestHost(): RuntimeEnvironment | null {
  let req: Request | null = null;
  try { req = getRequest(); } catch { return null; }
  if (!req) return null;
  let host: string | null = null;
  try { host = new URL(req.url).hostname.toLowerCase(); } catch { host = null; }
  // `Host` header du Worker : source la plus fiable après env var.
  if (!host) host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0] || null;
  if (!host) return null;

  if (PRODUCTION_HOSTS.has(host)) return "production";
  for (const s of PREVIEW_HOST_SUFFIXES) {
    if (host === s) return "preview";
  }
  // Fallback strict : n'accepter que les hostnames Preview contenant
  // explicitement l'UUID de CE projet. Aucun autre projet Lovable partageant
  // *.lovableproject.com ou *.lovable.app ne doit être considéré comme Preview.
  if (host.endsWith(".lovable.app") && host.startsWith(`id-preview--${PROJECT_ID}`)) return "preview";
  if (host === `${PROJECT_ID}.lovableproject.com`) return "preview";
  return null; // fail-closed
}

/**
 * Retourne l'environnement d'exécution du serveur pour la requête en cours.
 * Ne jamais lire depuis un input utilisateur.
 */
export function resolveRuntimeEnvironment(): RuntimeEnvironment | null {
  return fromEnvVar() ?? fromRequestHost();
}

export function describeRuntimeEnvironment(): {
  environment: RuntimeEnvironment | null;
  source: "env-var" | "request-host" | "unresolved";
  host: string | null;
} {
  const fromEnv = fromEnvVar();
  if (fromEnv) return { environment: fromEnv, source: "env-var", host: null };
  let host: string | null = null;
  try {
    const req = getRequest();
    host = new URL(req.url).hostname.toLowerCase();
  } catch { /* noop */ }
  const fromHost = fromRequestHost();
  return {
    environment: fromHost,
    source: fromHost ? "request-host" : "unresolved",
    host,
  };
}