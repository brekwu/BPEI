import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const getActiveCashSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase
      .rpc("get_active_cash_session_id", { _shop: data.shopId });
    if (error) throw new Error(error.message);
    if (!id) return { session: null, movements: [] };
    const [{ data: session }, { data: movements }] = await Promise.all([
      context.supabase.from("cash_sessions").select("*").eq("id", id as string).maybeSingle(),
      context.supabase.from("cash_movements").select("*").eq("session_id", id as string)
        .order("created_at", { ascending: true }),
    ]);
    return { session, movements: movements ?? [] };
  });

export const listRecentCashSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; limit?: number }) =>
    z.object({ shopId: uuid, limit: z.number().int().min(1).max(50).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("cash_sessions").select("*")
      .eq("shop_id", data.shopId)
      .order("opened_at", { ascending: false })
      .limit(data.limit ?? 20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const openCashSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; openingFloatCents?: number; registerLabel?: string; notes?: string }) =>
    z.object({
      shopId: uuid,
      openingFloatCents: z.number().int().min(0).max(100_000_000).optional(),
      registerLabel: z.string().max(80).optional(),
      notes: z.string().max(500).optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("open_cash_session", {
      _shop: data.shopId,
      _opening_float_cents: data.openingFloatCents ?? 0,
      _register_label: data.registerLabel ?? undefined,
      _notes: data.notes ?? undefined,
    });
    if (error) throw new Error(error.message);
    return id as string;
  });

export const addCashMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    sessionId: string;
    kind: "cash_in" | "cash_out" | "pickup" | "adjustment";
    amountCents: number;
    reason?: string;
    note?: string;
  }) => z.object({
    sessionId: uuid,
    kind: z.enum(["cash_in", "cash_out", "pickup", "adjustment"]),
    amountCents: z.number().int().min(1).max(100_000_000),
    reason: z.string().max(200).optional(),
    note: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("add_cash_movement", {
      _session: data.sessionId,
      _kind: data.kind,
      _amount_cents: data.amountCents,
      _reason: data.reason ?? undefined,
      _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    return id as string;
  });

export const closeCashSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    sessionId: string;
    countedCashCents: number;
    pickupCents?: number;
    notes?: string;
  }) => z.object({
    sessionId: uuid,
    countedCashCents: z.number().int().min(0).max(100_000_000),
    pickupCents: z.number().int().min(0).max(100_000_000).optional(),
    notes: z.string().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("close_cash_session", {
      _session: data.sessionId,
      _counted_cash_cents: data.countedCashCents,
      _pickup_cents: data.pickupCents ?? 0,
      _notes: data.notes ?? undefined,
    });
    if (error) throw new Error(error.message);
    return res as { expected_cents: number; counted_cents: number; variance_cents: number };
  });

export const getCashSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { sessionId: string }) => z.object({ sessionId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const [{ data: session, error: e1 }, { data: movements, error: e2 }] = await Promise.all([
      context.supabase.from("cash_sessions").select("*").eq("id", data.sessionId).maybeSingle(),
      context.supabase.from("cash_movements").select("*").eq("session_id", data.sessionId)
        .order("created_at", { ascending: true }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return { session, movements: movements ?? [] };
  });