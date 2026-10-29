import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertIsAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_platform_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin_bpei")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin_bpei required");
}

export const listPlatformUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertIsAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: usersData, error: usersErr }, rolesRes, membershipsRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
      supabaseAdmin.from("user_platform_roles").select("user_id, role"),
      supabaseAdmin.from("shop_memberships").select("user_id, shop_id, role"),
    ]);
    if (usersErr) throw new Error(usersErr.message);

    const roles = new Map<string, string[]>();
    (rolesRes.data ?? []).forEach((r: any) => {
      const arr = roles.get(r.user_id) ?? [];
      arr.push(r.role);
      roles.set(r.user_id, arr);
    });
    const memberships = new Map<string, number>();
    (membershipsRes.data ?? []).forEach((m: any) => {
      memberships.set(m.user_id, (memberships.get(m.user_id) ?? 0) + 1);
    });

    return (usersData.users ?? []).map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      confirmed: !!u.email_confirmed_at,
      platform_roles: roles.get(u.id) ?? [],
      shop_count: memberships.get(u.id) ?? 0,
    }));
  });

export const setPlatformRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      target_user_id: z.string().uuid(),
      role: z.enum(["admin_bpei"]),
      grant: z.boolean(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.supabase, context.userId);
    if (data.target_user_id === context.userId && !data.grant) {
      throw new Error("Impossible de retirer votre propre rôle admin_bpei");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_platform_roles")
        .upsert({ user_id: data.target_user_id, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_platform_roles")
        .delete()
        .eq("user_id", data.target_user_id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listActivityLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      limit: z.number().int().min(1).max(500).default(100),
      entity_type: z.string().optional(),
      action: z.string().optional(),
      shop_id: z.string().uuid().optional(),
    }).parse(data ?? {})
  )
  .handler(async ({ data, context }) => {
    await assertIsAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("activity_logs")
      .select("id, shop_id, actor_user_id, entity_type, entity_id, action, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.entity_type) q = q.eq("entity_type", data.entity_type);
    if (data.action) q = q.eq("action", data.action);
    if (data.shop_id) q = q.eq("shop_id", data.shop_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const shopIds = [...new Set(rows?.map((r) => r.shop_id).filter(Boolean) ?? [])];
    const userIds = [...new Set(rows?.map((r) => r.actor_user_id).filter(Boolean) ?? [])];
    const [shopsRes, usersRes] = await Promise.all([
      shopIds.length ? supabaseAdmin.from("shops").select("id, name").in("id", shopIds as string[]) : Promise.resolve({ data: [] }),
      userIds.length ? supabaseAdmin.auth.admin.listUsers({ perPage: 200 }) : Promise.resolve({ data: { users: [] } } as any),
    ]);
    const shopMap = new Map((shopsRes.data ?? []).map((s: any) => [s.id, s.name]));
    const userMap = new Map((usersRes.data?.users ?? []).map((u: any) => [u.id, u.email]));

    return (rows ?? []).map((r) => ({
      ...r,
      shop_name: r.shop_id ? shopMap.get(r.shop_id) ?? null : null,
      actor_email: r.actor_user_id ? userMap.get(r.actor_user_id) ?? null : null,
    }));
  });

export const getPlatformKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertIsAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [shops, users, apts, repairs, invoices, contacts30] = await Promise.all([
      supabaseAdmin.from("shops").select("id, status", { count: "exact" }),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1 }),
      supabaseAdmin.from("appointments").select("id", { count: "exact", head: true }).gte("created_at", d30),
      supabaseAdmin.from("repairs").select("id", { count: "exact", head: true }).gte("created_at", d30),
      supabaseAdmin.from("invoices").select("id", { count: "exact", head: true }).gte("created_at", d30),
      supabaseAdmin.from("contact_submissions").select("id", { count: "exact", head: true }).gte("created_at", d30),
    ]);
    const validatedShops = (shops.data ?? []).filter((s: any) => s.status === "validated").length;
    return {
      total_shops: shops.count ?? 0,
      validated_shops: validatedShops,
      total_users: (users.data as any)?.total ?? (users.data?.users?.length ?? 0),
      appointments_30d: apts.count ?? 0,
      repairs_30d: repairs.count ?? 0,
      invoices_30d: invoices.count ?? 0,
      contacts_30d: contacts30.count ?? 0,
    };
  });