import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const listTechnicianAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; userId?: string }) =>
    z.object({ shopId: uuid, userId: uuid.optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("technician_availability").select("*").eq("shop_id", data.shopId);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q.order("user_id").order("day_of_week");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertTechnicianAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; userId: string;
    slots: Array<{ day_of_week: number; opens_at: string; closes_at: string; is_available: boolean }>;
  }) => z.object({
    shopId: uuid, userId: uuid,
    slots: z.array(z.object({
      day_of_week: z.number().int().min(0).max(6),
      opens_at: z.string(), closes_at: z.string(),
      is_available: z.boolean(),
    })).max(30),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await context.supabase.from("technician_availability")
      .delete().eq("shop_id", data.shopId).eq("user_id", data.userId);
    if (data.slots.length > 0) {
      const { error } = await context.supabase.from("technician_availability")
        .insert(data.slots.map((s) => ({ ...s, shop_id: data.shopId, user_id: data.userId })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listTechnicianTimeOff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("technician_time_off")
      .select("*").eq("shop_id", data.shopId).order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTechnicianTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; userId: string; startsAt: string; endsAt: string; reason?: string | null }) =>
    z.object({
      shopId: uuid, userId: uuid,
      startsAt: z.string().datetime(), endsAt: z.string().datetime(),
      reason: z.string().max(200).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("technician_time_off").insert({
      shop_id: data.shopId, user_id: data.userId,
      starts_at: data.startsAt, ends_at: data.endsAt,
      reason: data.reason ?? null, status: "approved",
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTechnicianTimeOff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("technician_time_off").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listBlockedSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("appointment_blocked_slots")
      .select("*").eq("shop_id", data.shopId).order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createBlockedSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; startsAt: string; endsAt: string; technicianUserId?: string | null; reason?: string | null }) =>
    z.object({
      shopId: uuid,
      startsAt: z.string().datetime(), endsAt: z.string().datetime(),
      technicianUserId: uuid.nullable().optional(),
      reason: z.string().max(200).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("appointment_blocked_slots").insert({
      shop_id: data.shopId,
      starts_at: data.startsAt, ends_at: data.endsAt,
      technician_user_id: data.technicianUserId ?? null,
      reason: data.reason ?? null,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBlockedSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("appointment_blocked_slots").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });