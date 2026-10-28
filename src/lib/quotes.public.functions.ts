// Public (unauthenticated) server functions for quote sharing via secure token.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

function serverPublicClient() {
  // Lazy import so browser bundle stays clean
  return import("@supabase/supabase-js").then(({ createClient }) => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
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
  });
}

export const publicGetQuote = createServerFn({ method: "GET" })
  .inputValidator((i: { token: string }) => z.object({ token: z.string().min(10).max(200) }).parse(i))
  .handler(async ({ data }) => {
    const supabase = await serverPublicClient();
    const { data: res, error } = await supabase.rpc("public_get_quote", { _token: data.token });
    if (error) throw new Error(error.message);
    return res as any;
  });

export const publicAcceptQuote = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string; name: string; signature?: string | null }) =>
    z.object({
      token: z.string().min(10).max(200),
      name: z.string().min(2).max(120),
      signature: z.string().max(200000).nullable().optional(),
    }).parse(i))
  .handler(async ({ data }) => {
    const supabase = await serverPublicClient();
    let ip: string | undefined;
    try { ip = getRequestIP({ xForwardedFor: true }) ?? undefined; } catch { /* ignore */ }
    let ua: string | undefined;
    try { ua = getRequestHeader("user-agent") ?? undefined; } catch { /* ignore */ }
    const { error } = await supabase.rpc("public_accept_quote", {
      _token: data.token, _name: data.name, _signature: data.signature ?? undefined,
      _ip: ip, _ua: ua,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const publicRefuseQuote = createServerFn({ method: "POST" })
  .inputValidator((i: { token: string; reason?: string | null }) =>
    z.object({ token: z.string().min(10).max(200), reason: z.string().max(1000).nullable().optional() }).parse(i))
  .handler(async ({ data }) => {
    const supabase = await serverPublicClient();
    const { error } = await supabase.rpc("public_refuse_quote", {
      _token: data.token, _reason: data.reason ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });