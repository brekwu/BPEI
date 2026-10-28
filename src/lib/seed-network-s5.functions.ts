/**
 * Sous-lot 5-ter — Seed idempotent des 8 comptes Auth réels pour les tests réseau partenariats.
 *
 * Guard : owner_bpei ou admin_bpei.
 * Idempotent : ré-exécutable, ne duplique jamais un utilisateur ou une membership.
 *
 * Le mot de passe est généré aléatoirement côté serveur à chaque exécution et
 * retourné dans la réponse — jamais stocké côté client ni exporté depuis ce module.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


type SeedAccount = {
  key: string;
  email: string;
  shopId: string;
  shopName: string;
  businessType: "physical_shop" | "mobile_independent" | "hybrid_business" | "multi_location_network";
  plan: "shop_essential" | "shop_pro" | "shop_network" | "independent_intervention" | "independent_partner";
  verified: boolean;
  roles: string[]; // shop_membership.role values
};

// UUIDs déterministes pour idempotence.
const SEED: SeedAccount[] = [
  {
    key: "shop_essentiel",
    email: "test.shop.essentiel@bpei.test",
    shopId: "11111111-0000-4000-8000-000000000001",
    shopName: "[TEST-S5] Boutique Essentiel Nice",
    businessType: "physical_shop",
    plan: "shop_essential",
    verified: true,
    roles: ["shop_manager"],
  },
  {
    key: "shop_pro",
    email: "test.shop.pro@bpei.test",
    shopId: "11111111-0000-4000-8000-000000000002",
    shopName: "[TEST-S5] Boutique Pro Paris 11",
    businessType: "physical_shop",
    plan: "shop_pro",
    verified: true,
    roles: ["shop_manager"],
  },
  {
    key: "shop_reseau",
    email: "test.shop.reseau@bpei.test",
    shopId: "11111111-0000-4000-8000-000000000003",
    shopName: "[TEST-S5] Réseau Lyon-Villeurbanne",
    businessType: "multi_location_network",
    plan: "shop_network",
    verified: true,
    roles: ["network_owner", "shop_manager"],
  },
  {
    key: "indep_intervention",
    email: "test.indep.intervention@bpei.test",
    shopId: "11111111-0000-4000-8000-000000000004",
    shopName: "[TEST-S5] Indep Intervention Marseille",
    businessType: "mobile_independent",
    plan: "independent_intervention",
    verified: false,
    roles: ["network_owner", "shop_manager"],
  },
  {
    key: "indep_premium_unverified",
    email: "test.indep.premium.unverified@bpei.test",
    shopId: "11111111-0000-4000-8000-000000000005",
    shopName: "[TEST-S5] Indep Premium non vérifié",
    businessType: "mobile_independent",
    plan: "independent_partner",
    verified: false,
    roles: ["network_owner", "shop_manager"],
  },
  {
    key: "indep_premium_verified",
    email: "test.indep.premium.verified@bpei.test",
    shopId: "11111111-0000-4000-8000-000000000006",
    shopName: "[TEST-S5] Indep Premium vérifié Toulouse",
    businessType: "mobile_independent",
    plan: "independent_partner",
    verified: true,
    roles: ["network_owner", "shop_manager"],
  },
  {
    key: "hybride",
    email: "test.hybride@bpei.test",
    shopId: "11111111-0000-4000-8000-000000000007",
    shopName: "[TEST-S5] Hybride Bordeaux",
    businessType: "hybrid_business",
    plan: "independent_partner",
    verified: true,
    roles: ["network_owner", "shop_manager"],
  },
  {
    key: "patron",
    email: "test.patron@bpei.test",
    shopId: "", // pas de shop pour le patron
    shopName: "",
    businessType: "physical_shop",
    plan: "shop_essential",
    verified: false,
    roles: [],
  },
];

async function assertOwnerOrAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_platform_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = new Set((data ?? []).map((r: any) => r.role));
  if (!roles.has("owner_bpei") && !roles.has("admin_bpei")) {
    throw new Error("Forbidden: owner_bpei or admin_bpei required");
  }
}

export const seedNetworkS5 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwnerOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomBytes } = await import("crypto");
    // Mot de passe aléatoire généré à chaque exécution (jamais exporté côté client).
    const TEST_ACCOUNTS_PASSWORD =
      "Bpei!" + randomBytes(18).toString("base64url") + "#S5";

    const report: Array<{ key: string; email: string; userId: string; action: string; shopId?: string }> = [];

    // Récupère tous les users existants une seule fois (200 max, plus que suffisant en test).
    const { data: usersList, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (usersErr) throw new Error(usersErr.message);
    const byEmail = new Map<string, string>();
    for (const u of usersList.users) {
      if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    }

    for (const acc of SEED) {
      let userId = byEmail.get(acc.email.toLowerCase());
      let action = "existed";

      if (!userId) {
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: acc.email,
          password: TEST_ACCOUNTS_PASSWORD,
          email_confirm: true,
          user_metadata: { seed_key: acc.key, seeded_by: "seed-network-s5" },
        });
        if (createErr) throw new Error(`Create ${acc.email}: ${createErr.message}`);
        userId = created.user!.id;
        action = "created";
      } else {
        // Force le mot de passe pour rester idempotent (au cas où il aurait été changé).
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: TEST_ACCOUNTS_PASSWORD });
      }

      // Patron : rôle plateforme owner_bpei uniquement.
      if (acc.key === "patron") {
        await supabaseAdmin
          .from("user_platform_roles")
          .upsert({ user_id: userId, role: "owner_bpei" }, { onConflict: "user_id,role" });
        report.push({ key: acc.key, email: acc.email, userId, action });
        continue;
      }

      // Shop : upsert idempotent avec ID déterministe.
      const shopPayload: any = {
        id: acc.shopId,
        name: acc.shopName,
        legal_name: acc.shopName,
        business_type: acc.businessType,
        verification_status: acc.verified ? "verified" : "not_submitted",
        owner_user_id: userId,
        status: "validated",
        public_profile_status: "published",
        onboarding_status: "completed",
        public_name: acc.shopName,
        city:
          acc.businessType === "mobile_independent"
            ? null
            : acc.shopName.includes("Paris")
              ? "Paris"
              : acc.shopName.includes("Lyon")
                ? "Lyon"
                : acc.shopName.includes("Marseille")
                  ? "Marseille"
                  : acc.shopName.includes("Toulouse")
                    ? "Toulouse"
                    : acc.shopName.includes("Bordeaux")
                      ? "Bordeaux"
                      : "Nice",
        private_city:
          acc.businessType === "mobile_independent"
            ? acc.shopName.includes("Marseille")
              ? "Marseille"
              : acc.shopName.includes("Toulouse")
                ? "Toulouse"
                : "Nantes"
            : null,
        service_radius_km: acc.businessType === "mobile_independent" ? 25 : null,
        covered_cities: acc.businessType === "mobile_independent" ? ["Marseille", "Aix-en-Provence"] : [],
        covered_postal_codes: acc.businessType === "mobile_independent" ? ["13001", "13002"] : [],
      };
      const { error: shopErr } = await supabaseAdmin.from("shops").upsert(shopPayload, { onConflict: "id" });
      if (shopErr) throw new Error(`Shop ${acc.shopId}: ${shopErr.message}`);

      // Subscription active.
      await supabaseAdmin.from("shop_subscriptions").upsert(
        {
          shop_id: acc.shopId,
          plan: acc.plan as any,
          status: "active" as any,
          started_at: new Date().toISOString(),
          ends_at: new Date("2026-08-31T23:59:59Z").toISOString(),
          price_cents_current: 0,
          activated_by: context.userId,
          origin: "seed-network-s5",
        },
        { onConflict: "shop_id" },
      );

      // Memberships : dédoublonnées.
      for (const role of acc.roles) {
        await supabaseAdmin.from("shop_memberships").upsert(
          { shop_id: acc.shopId, user_id: userId, role: role as any },
          { onConflict: "shop_id,user_id,role" },
        );
      }

      report.push({ key: acc.key, email: acc.email, userId, action, shopId: acc.shopId });
    }

    return {
      ok: true,
      count: report.length,
      password: TEST_ACCOUNTS_PASSWORD,
      accounts: report,
    };
  });

export const cleanupNetworkS5 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwnerOrAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const removed: string[] = [];

    // Purge shops [TEST-S5]* (cascade sur memberships / subscriptions).
    const shopIds = SEED.filter((a) => a.shopId).map((a) => a.shopId);
    if (shopIds.length) {
      await supabaseAdmin.from("shops").delete().in("id", shopIds);
      removed.push(`${shopIds.length} shops`);
    }

    // Purge users test.*@bpei.test.
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const toDelete = usersList.users.filter((u: any) => u.email?.endsWith("@bpei.test"));
    for (const u of toDelete) {
      await supabaseAdmin.auth.admin.deleteUser(u.id);
    }
    removed.push(`${toDelete.length} users`);

    return { ok: true, removed };
  });