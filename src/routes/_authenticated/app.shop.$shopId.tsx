import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ShopLayout, type EffectiveRole } from "@/components/shop/ShopLayout";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId")({
  head: () => ({ meta: [{ title: "Espace boutique — BPEI" }] }),
  loader: async ({ params, location }) => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });


    const [shopRes, memRes, roleRes, subRes] = await Promise.all([
      supabase.from("shops").select("id, name, public_name, owner_user_id, status, onboarding_status, business_type, verification_status").eq("id", params.shopId).maybeSingle(),
      supabase.from("shop_memberships").select("role").eq("shop_id", params.shopId).eq("user_id", uid),
      supabase.from("user_platform_roles").select("role").eq("user_id", uid),
      supabase.rpc("shop_subscription_state", { _shop: params.shopId }),
    ]);

    if (!shopRes.data) throw redirect({ to: "/app" });

    const platformRoles = new Set((roleRes.data ?? []).map((r) => r.role));
    const isAdmin = platformRoles.has("admin_bpei") || platformRoles.has("owner_bpei");
    const isOwner = shopRes.data.owner_user_id === uid;
    const memberships = memRes.data ?? [];

    let role: EffectiveRole | null = null;
    if (isAdmin) role = "admin_bpei";
    else if (isOwner) role = "owner";
    else if (memberships.length > 0) {
      const priority = ["network_owner", "shop_manager", "technician", "employee"] as const;
      for (const p of priority) if (memberships.some((m) => m.role === p)) { role = p; break; }
    }
    if (!role) throw redirect({ to: "/app" });

    const sub = (subRes.data ?? null) as null | {
      effective_status: string;
      ends_at: string | null;
      days_remaining: number | null;
      plan: string;
      status: string;
    };

    // Gate abonnement : bloquer si expiré, sauf pour admin/owner_bpei
    if (!isAdmin && sub && sub.effective_status === "expired") {
      throw redirect({ to: "/app/subscription-required" });
    }

    // Redirection onboarding : gérant boutique dont l'onboarding n'est pas terminé
    const needsOnboarding = (shopRes.data as any).onboarding_status !== "completed"
      && (role === "shop_manager" || role === "network_owner" || role === "owner");
    const onOnboarding = location.pathname.endsWith("/onboarding");
    if (needsOnboarding && !onOnboarding && !isAdmin) {
      throw redirect({ to: "/app/shop/$shopId/onboarding", params: { shopId: params.shopId } });
    }


    return {
      shopId: shopRes.data.id,
      shopName: shopRes.data.public_name || shopRes.data.name,
      role,
      subscription: sub,
      businessType: (shopRes.data as any).business_type ?? null,
      verificationStatus: (shopRes.data as any).verification_status ?? null,
    };
  },
  component: ShopWorkspace,
  pendingComponent: () => (
    <div className="p-8 text-sm text-muted-foreground">Chargement de la boutique…</div>
  ),
});

function ShopWorkspace() {
  const ctx = Route.useLoaderData();
  return (
    <ShopLayout ctx={ctx}>
      <Outlet />
    </ShopLayout>
  );
}