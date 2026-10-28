import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppointmentUpdate = Database["public"]["Tables"]["appointments"]["Update"];
type ReviewUpdate = Database["public"]["Tables"]["reviews"]["Update"];

const uuid = z.string().uuid();

export const listAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; from?: string; to?: string }) =>
    z.object({
      shopId: uuid,
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("appointments").select("*").eq("shop_id", data.shopId).order("starts_at");
    if (data.from) q = q.gte("starts_at", data.from);
    if (data.to) q = q.lte("starts_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; serviceId?: string | null; startsAt: string; endsAt: string;
    contactName: string; contactPhone: string; contactEmail?: string | null;
    deviceDescription?: string | null; problemDescription?: string | null;
    customerId?: string | null; technicianUserId?: string | null;
    isUrgent?: boolean; status?: "pending" | "confirmed";
  }) => z.object({
    shopId: uuid,
    serviceId: uuid.nullable().optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    contactName: z.string().min(2).max(120),
    contactPhone: z.string().min(4).max(40),
    contactEmail: z.string().email().nullable().optional(),
    deviceDescription: z.string().max(500).nullable().optional(),
    problemDescription: z.string().max(2000).nullable().optional(),
    customerId: uuid.nullable().optional(),
    technicianUserId: uuid.nullable().optional(),
    isUrgent: z.boolean().optional(),
    status: z.enum(["pending", "confirmed"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("appointments").insert({
      shop_id: data.shopId,
      service_id: data.serviceId ?? null,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      contact_name: data.contactName,
      contact_phone: data.contactPhone,
      contact_email: data.contactEmail ?? null,
      device_description: data.deviceDescription ?? null,
      problem_description: data.problemDescription ?? null,
      customer_id: data.customerId ?? null,
      technician_user_id: data.technicianUserId ?? null,
      is_urgent: data.isUrgent ?? false,
      status: data.status ?? "confirmed",
      source: "manual",
      created_by: context.userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

const SLOT_ERRORS: Record<string, string> = {
  access_denied: "Accès refusé à cette boutique.",
  invalid_range: "La date de fin doit être postérieure au début.",
  shop_closed: "La boutique est fermée sur ce créneau.",
  shop_closed_today: "La boutique est fermée ce jour-là.",
  slot_blocked: "Ce créneau a été bloqué.",
  outside_business_hours: "Créneau en dehors des horaires d'ouverture.",
  during_break: "Créneau pendant la pause.",
  slot_collision: "Ce créneau chevauche un autre rendez-vous.",
  technician_off: "Ce technicien est absent sur ce créneau.",
};
function humanizeSlotError(msg: string): string {
  const key = Object.keys(SLOT_ERRORS).find((k) => msg.includes(k));
  return key ? SLOT_ERRORS[key] : msg;
}

export const updateAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    id: string;
    startsAt?: string; endsAt?: string;
    status?: "pending" | "confirmed" | "cancelled" | "no_show" | "completed" | "in_progress";
    technicianUserId?: string | null;
    internalNotes?: string | null;
    cancellationReason?: string | null;
    isUrgent?: boolean;
  }) => z.object({
    id: uuid,
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    status: z.enum(["pending", "confirmed", "cancelled", "no_show", "completed", "in_progress"]).optional(),
    technicianUserId: uuid.nullable().optional(),
    internalNotes: z.string().max(4000).nullable().optional(),
    cancellationReason: z.string().max(500).nullable().optional(),
    isUrgent: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    // Load current row to compute effective slot for re-validation
    const { data: current, error: loadErr } = await context.supabase
      .from("appointments").select("shop_id, starts_at, ends_at, technician_user_id, status")
      .eq("id", data.id).maybeSingle();
    if (loadErr) throw new Error(loadErr.message);
    if (!current) throw new Error("Rendez-vous introuvable.");

    const nextStart = data.startsAt ?? current.starts_at;
    const nextEnd = data.endsAt ?? current.ends_at;
    const nextTech = data.technicianUserId !== undefined ? data.technicianUserId : current.technician_user_id;
    const nextStatus = data.status ?? current.status;

    const timeChanged = (data.startsAt && data.startsAt !== current.starts_at)
      || (data.endsAt && data.endsAt !== current.ends_at)
      || (data.technicianUserId !== undefined && data.technicianUserId !== current.technician_user_id);

    if (timeChanged && !["cancelled", "no_show"].includes(nextStatus)) {
      const { error: chkErr } = await context.supabase.rpc("check_appointment_slot" as never, {
        _shop_id: current.shop_id,
        _starts_at: nextStart,
        _ends_at: nextEnd,
        _technician_user_id: nextTech,
        _exclude_appointment_id: data.id,
      } as never);
      if (chkErr) throw new Error(humanizeSlotError(chkErr.message));
    }

    const patch: AppointmentUpdate = {};
    if (data.startsAt) patch.starts_at = data.startsAt;
    if (data.endsAt) patch.ends_at = data.endsAt;
    if (data.status) {
      patch.status = data.status;
      if (data.status === "cancelled") {
        patch.cancelled_at = new Date().toISOString();
        if (data.cancellationReason !== undefined) patch.cancellation_reason = data.cancellationReason;
      }
    }
    if (data.technicianUserId !== undefined) patch.technician_user_id = data.technicianUserId;
    if (data.internalNotes !== undefined) patch.internal_notes = data.internalNotes;
    if (data.isUrgent !== undefined) patch.is_urgent = data.isUrgent;
    const { error } = await context.supabase.from("appointments").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const convertAppointmentToRepair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { appointmentId: string; customerId: string; deviceId: string }) =>
    z.object({ appointmentId: uuid, customerId: uuid, deviceId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: repairId, error } = await context.supabase.rpc("convert_appointment_to_repair" as never, {
      _appointment_id: data.appointmentId,
      _customer_id: data.customerId,
      _device_id: data.deviceId,
    } as never);
    if (error) {
      if (error.message.includes("already_converted")) throw new Error("Ce rendez-vous a déjà été converti en réparation.");
      if (error.message.includes("customer_not_in_shop")) throw new Error("Ce client n'appartient pas à cette boutique.");
      if (error.message.includes("device_not_in_shop")) throw new Error("Cet appareil n'appartient pas à cette boutique.");
      throw new Error(error.message);
    }
    return { repairId: repairId as unknown as string };
  });

export const listShopTechnicians = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("list_shop_technicians" as never, { _shop_id: data.shopId } as never);
    if (error) throw new Error(error.message);
    return (rows as unknown as Array<{ user_id: string; role: string; first_name: string | null; last_name: string | null }>) ?? [];
  });

export const listBusinessHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("shop_business_hours")
      .select("*").eq("shop_id", data.shopId).order("day_of_week");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertBusinessHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; hours: Array<{
    day_of_week: number; is_closed: boolean;
    opens_at: string | null; closes_at: string | null;
    break_start: string | null; break_end: string | null;
  }> }) => z.object({
    shopId: uuid,
    hours: z.array(z.object({
      day_of_week: z.number().min(0).max(6),
      is_closed: z.boolean(),
      opens_at: z.string().nullable(),
      closes_at: z.string().nullable(),
      break_start: z.string().nullable(),
      break_end: z.string().nullable(),
    })).max(7),
  }).parse(i))
  .handler(async ({ data, context }) => {
    // Delete then insert (simplest for 7 rows max)
    await context.supabase.from("shop_business_hours").delete().eq("shop_id", data.shopId);
    if (data.hours.length > 0) {
      const { error } = await context.supabase.from("shop_business_hours")
        .insert(data.hours.map((h) => ({ ...h, shop_id: data.shopId })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listClosures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("shop_closures")
      .select("*").eq("shop_id", data.shopId).order("starts_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createClosure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; startsAt: string; endsAt: string; reason?: string | null }) =>
    z.object({
      shopId: uuid,
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      reason: z.string().max(200).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("shop_closures").insert({
      shop_id: data.shopId,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      reason: data.reason ?? null,
      created_by: context.userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteClosure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("shop_closures").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOrCreateRepairToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { repairId: string }) => z.object({ repairId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc("get_or_create_repair_token", { _repair_id: data.repairId });
    if (error) throw new Error(error.message);
    return { token: token as string };
  });

export const revokeRepairToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { repairId: string }) => z.object({ repairId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("repair_public_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("repair_id", data.repairId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("reviews")
      .select("*").eq("shop_id", data.shopId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const moderateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: "published" | "rejected" | "pending"; reply?: string | null }) =>
    z.object({
      id: uuid,
      status: z.enum(["published", "rejected", "pending"]),
      reply: z.string().max(2000).nullable().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const patch: ReviewUpdate = { status: data.status };
    if (data.status === "published") patch.published_at = new Date().toISOString();
    if (data.reply !== undefined) {
      patch.reply_text = data.reply;
      patch.replied_at = data.reply ? new Date().toISOString() : null;
      patch.replied_by = data.reply ? context.userId : null;
    }
    const { error } = await context.supabase.from("reviews").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });