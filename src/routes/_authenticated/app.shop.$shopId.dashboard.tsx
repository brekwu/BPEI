import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, PriorityBadge } from "@/components/shop/StatusBadge";
import {
  OPEN_STATUSES, AWAITING_DIAG_STATUSES, READY_STATUSES,
  customerDisplayName,
} from "@/lib/shop-constants";
import { Wrench, Users, Cpu, Plus, Activity, PackageCheck, ClipboardList, CheckCircle2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — BPEI" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { shopId, shopName } = useShop();
  const base = `/app/shop/${shopId}`;

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", shopId],
    queryFn: async () => {
      const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [open, awaitingDiag, ready, completedMonth, newCustomers, recentRepairs, recentActivity] = await Promise.all([
        supabase.from("repairs").select("id", { count: "exact", head: true }).eq("shop_id", shopId).is("archived_at", null).in("status", OPEN_STATUSES),
        supabase.from("repairs").select("id", { count: "exact", head: true }).eq("shop_id", shopId).is("archived_at", null).in("status", AWAITING_DIAG_STATUSES),
        supabase.from("repairs").select("id", { count: "exact", head: true }).eq("shop_id", shopId).is("archived_at", null).in("status", READY_STATUSES),
        supabase.from("repairs").select("id", { count: "exact", head: true }).eq("shop_id", shopId).gte("completed_at", firstOfMonth),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("shop_id", shopId).gte("created_at", firstOfMonth),
        supabase.from("repairs").select("id, repair_number, status, priority, created_at, customers(customer_type, company_name, first_name, last_name), devices(brand, model)").eq("shop_id", shopId).is("archived_at", null).order("created_at", { ascending: false }).limit(8),
        supabase.from("activity_logs").select("id, action, entity_type, created_at").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(6),
      ]);
      return {
        openCount: open.count ?? 0,
        awaitingDiagCount: awaitingDiag.count ?? 0,
        readyCount: ready.count ?? 0,
        completedMonthCount: completedMonth.count ?? 0,
        newCustomersCount: newCustomers.count ?? 0,
        recentRepairs: recentRepairs.data ?? [],
        recentActivity: recentActivity.data ?? [],
      };
    },
  });

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={today}
        title={`Bonjour, ${shopName}`}
        description="Voici un aperçu de votre activité et des dossiers à traiter aujourd'hui."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/shop/$shopId/clients/new" params={{ shopId }}><Users className="mr-2 h-4 w-4" />Client</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/shop/$shopId/devices/new" params={{ shopId }}><Cpu className="mr-2 h-4 w-4" />Appareil</Link>
            </Button>
            <Button asChild size="sm" className="bg-electric text-electric-foreground shadow-sm hover:bg-electric/90">
              <Link to="/app/shop/$shopId/repairs/new" params={{ shopId }}><Plus className="mr-2 h-4 w-4" />Nouvelle réparation</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Réparations ouvertes"
          value={data?.openCount ?? 0}
          icon={<Wrench className="h-5 w-5" />}
          accent="electric"
          loading={isLoading}
          hint="dossiers actifs"
        />
        <StatCard
          label="En attente diagnostic"
          value={data?.awaitingDiagCount ?? 0}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="warning"
          loading={isLoading}
          hint="à qualifier"
        />
        <StatCard
          label="Prêtes à récupérer"
          value={data?.readyCount ?? 0}
          icon={<PackageCheck className="h-5 w-5" />}
          accent="success"
          loading={isLoading}
          hint="à notifier au client"
        />
        <StatCard
          label="Terminées ce mois"
          value={data?.completedMonthCount ?? 0}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="default"
          loading={isLoading}
          hint={`+${data?.newCustomersCount ?? 0} nouveaux clients`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          padded={false}
          title="Réparations récentes"
          description="Les 8 dossiers les plus récents"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/shop/$shopId/repairs" params={{ shopId }}>
                Tout voir <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {isLoading ? (
            <div className="p-5 text-sm text-muted-foreground">Chargement…</div>
          ) : (data?.recentRepairs.length ?? 0) === 0 ? (
            <EmptyState
              className="m-5"
              icon={<Wrench className="h-5 w-5" />}
              title="Aucune réparation"
              description="Créez votre première réparation pour la voir apparaître ici."
              action={
                <Button asChild size="sm" className="bg-electric text-electric-foreground hover:bg-electric/90">
                  <Link to="/app/shop/$shopId/repairs/new" params={{ shopId }}><Plus className="mr-2 h-4 w-4" />Nouvelle réparation</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {data?.recentRepairs.map((r: any) => {
                const c = r.customers;
                const d = r.devices;
                return (
                  <li key={r.id}>
                    <Link
                      to="/app/shop/$shopId/repairs/$repairId" params={{ shopId, repairId: r.id }}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-surface-muted sm:flex sm:flex-wrap"
                    >
                      <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[11px] font-medium text-navy shrink-0">
                        {r.repair_number}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{c ? customerDisplayName(c) : "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {d ? `${d.brand ?? ""} ${d.model ?? ""}`.trim() || "Appareil" : "—"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriorityBadge priority={r.priority} />
                        <StatusBadge status={r.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Activité récente" description="Dernières actions sur la boutique">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (data?.recentActivity.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Activity className="h-5 w-5" />}
              title="Rien à afficher"
              description="Les actions importantes apparaîtront ici."
            />
          ) : (
            <ul className="space-y-3.5">
              {data?.recentActivity.map((a: any) => (
                <li key={a.id} className="flex gap-3">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-electric-soft text-electric">
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{a.action}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.entity_type} · {new Date(a.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}