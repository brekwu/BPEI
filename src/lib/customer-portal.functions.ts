// Lot B — Gestion des invitations portail client (côté boutique) + acceptation côté client.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const createSchema = z.object({
  customerId: z.string().uuid(),
  expiresDays: z.number().int().min(1).max(365).optional(),
});

export const createPortalInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as any).rpc("create_customer_portal_invitation", {
      _customer_id: data.customerId,
      _expires_days: data.expiresDays ?? 30,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(res) ? res[0] : res;
    return { id: row.id as string, token: row.token as string, expiresAt: row.expires_at as string };
  });

export const listPortalInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [invRes, linkRes] = await Promise.all([
      context.supabase
        .from("customer_portal_invitations")
        .select("id, email, token, status, expires_at, accepted_at, created_at")
        .eq("customer_id", data.customerId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("customer_portal_links")
        .select("id, user_id, linked_via, created_at")
        .eq("customer_id", data.customerId)
        .order("created_at", { ascending: false }),
    ]);
    if (invRes.error) throw new Error(invRes.error.message);
    if (linkRes.error) throw new Error(linkRes.error.message);
    return { invitations: invRes.data ?? [], links: linkRes.data ?? [] };
  });

export const revokePortalInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("revoke_customer_portal_invitation", { _invitation_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removePortalLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customer_portal_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptPortalInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await (context.supabase as any).rpc("accept_customer_portal_invitation", { _token: data.token });
    if (error) throw new Error(error.message);
    const row = Array.isArray(res) ? res[0] : res;
    return { shopId: row?.shop_id as string, customerId: row?.customer_id as string };
  });

export const cancelPortalAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ appointmentId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("portal_cancel_appointment", {
      _appointment_id: data.appointmentId,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });