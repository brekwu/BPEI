// Server-only: rate limiting + IP block enforcement + abuse logging.
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";
import { verifyTurnstile } from "./turnstile.server";

export class RateLimitError extends Error {
  status: number;
  code: string;
  constructor(message: string, code: string, status = 429) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Endpoint = "book_appointment" | "submit_review" | "public_read" | "contact" | "network_form";

interface Scope {
  type: "ip" | "shop" | "ip_shop" | "fingerprint";
  key: string;
  windowSeconds: number;
  max: number;
}

const PRESETS: Record<Endpoint, (opts: { ip: string; shopId?: string | null; fingerprint?: string | null }) => Scope[]> = {
  book_appointment: ({ ip, shopId }) => [
    { type: "ip", key: ip, windowSeconds: 3600, max: 5 },
    ...(shopId ? [
      { type: "shop" as const, key: shopId, windowSeconds: 86400, max: 30 },
      { type: "ip_shop" as const, key: `${ip}|${shopId}`, windowSeconds: 3600, max: 3 },
    ] : []),
  ],
  submit_review: ({ ip, shopId }) => [
    { type: "ip", key: ip, windowSeconds: 86400, max: 3 },
    ...(shopId ? [{ type: "shop" as const, key: shopId, windowSeconds: 86400, max: 10 }] : []),
  ],
  public_read: ({ ip }) => [
    { type: "ip", key: ip, windowSeconds: 60, max: 60 },
  ],
  contact: ({ ip, shopId }) => [
    { type: "ip", key: ip, windowSeconds: 3600, max: 3 },
    ...(shopId ? [{ type: "shop" as const, key: shopId, windowSeconds: 86400, max: 20 }] : []),
  ],
  network_form: ({ ip }) => [
    { type: "ip", key: ip, windowSeconds: 3600, max: 5 },
  ],
};

function pepperHash(input: string): string {
  const pepper = process.env.HASH_PEPPER ?? "no-pepper";
  return createHash("sha256").update(`${input}::${pepper}`).digest("hex");
}

function windowStart(seconds: number): string {
  const now = Date.now();
  const ms = seconds * 1000;
  return new Date(Math.floor(now / ms) * ms).toISOString();
}

export interface EnforceArgs {
  endpoint: Endpoint;
  shopId?: string | null;
  fingerprint?: string | null;
  turnstileToken?: string | null;
  requireTurnstile?: boolean;
}

interface EnforceContext {
  ip: string;
  ipHash: string;
  ua: string | null;
}

function readRequestMeta(): EnforceContext {
  // La vraie IP provient exclusivement d'en-têtes de confiance Cloudflare.
  // X-Forwarded-For n'est jamais consulté (facilement falsifiable côté client).
  let ip = "0.0.0.0";
  try {
    const cf = getRequestHeader("cf-connecting-ip");
    if (cf) {
      ip = cf.trim();
    } else if (process.env.NODE_ENV !== "production") {
      // Dev / preview : pas de reverse proxy Cloudflare, on tolère
      // l'IP socket. En production, l'absence de CF-Connecting-IP
      // signifie que la requête n'est pas passée par le proxy attendu :
      // on laisse "0.0.0.0" pour agréger et déclencher les seuils IP.
      const rip = getRequestIP({ xForwardedFor: false });
      if (rip) ip = rip;
    } else {
      console.warn(
        "[rate-limit] PRODUCTION: en-tête cf-connecting-ip absent — requête non issue de Cloudflare ?",
      );
    }
  } catch { /* ignore */ }
  let ua: string | null = null;
  try { ua = getRequestHeader("user-agent") ?? null; } catch { /* ignore */ }
  return { ip, ipHash: pepperHash(ip), ua };
}

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

export async function enforceRateLimit(args: EnforceArgs): Promise<{ ip: string; ipHash: string }> {
  const ctx = readRequestMeta();
  const supa = await serviceRoleClient();

  // 1. Check IP block
  const { data: blocked } = await supa.rpc("is_ip_blocked", { _ip_hash: ctx.ipHash });
  if (blocked) {
    await supa.rpc("record_abuse", {
      _ip: ctx.ip, _ip_hash: ctx.ipHash, _fingerprint: args.fingerprint ?? null,
      _shop_id: args.shopId ?? null, _endpoint: args.endpoint,
      _event_type: "blocked_ip_attempt", _severity: "warn",
      _ua: ctx.ua, _metadata: {},
    });
    throw new RateLimitError("Accès temporairement bloqué.", "ip_blocked", 403);
  }

  // 2. Turnstile
  if (args.requireTurnstile) {
    const tv = await verifyTurnstile(args.turnstileToken, ctx.ip);
    if (!tv.success) {
      await supa.rpc("record_abuse", {
        _ip: ctx.ip, _ip_hash: ctx.ipHash, _fingerprint: args.fingerprint ?? null,
        _shop_id: args.shopId ?? null, _endpoint: args.endpoint,
        _event_type: "captcha_failed", _severity: "warn",
        _ua: ctx.ua, _metadata: { errorCodes: tv.errorCodes ?? [] },
      });
      throw new RateLimitError("Vérification anti-robot échouée. Réessayez.", "captcha_failed", 403);
    }
  }

  // 3. Rate limits
  const scopes = PRESETS[args.endpoint]({ ip: ctx.ip, shopId: args.shopId, fingerprint: args.fingerprint });
  for (const s of scopes) {
    const ws = windowStart(s.windowSeconds);
    const scopeKey = s.type === "ip" ? ctx.ipHash
      : s.type === "ip_shop" ? `${ctx.ipHash}|${args.shopId ?? ""}`
      : s.type === "fingerprint" ? pepperHash(s.key)
      : s.key;
    const { data: cnt, error } = await supa.rpc("rate_limit_hit", {
      _scope_type: s.type, _scope_key: scopeKey, _endpoint: args.endpoint, _window_start: ws,
    });
    if (error) { console.error("[rate-limit] hit error", error); continue; }
    if ((cnt as number) > s.max) {
      await supa.rpc("record_abuse", {
        _ip: ctx.ip, _ip_hash: ctx.ipHash, _fingerprint: args.fingerprint ?? null,
        _shop_id: args.shopId ?? null, _endpoint: args.endpoint,
        _event_type: "rate_limit_hit", _severity: "warn",
        _ua: ctx.ua, _metadata: { scope: s.type, count: cnt, max: s.max, windowSeconds: s.windowSeconds },
      });
      throw new RateLimitError(
        s.windowSeconds >= 3600
          ? "Trop de tentatives. Réessayez dans quelques heures."
          : "Trop de tentatives. Merci de patienter avant de recommencer.",
        "rate_limited", 429,
      );
    }
  }

  return { ip: ctx.ip, ipHash: ctx.ipHash };
}

export function hashForClient(value: string): string {
  return pepperHash(value);
}