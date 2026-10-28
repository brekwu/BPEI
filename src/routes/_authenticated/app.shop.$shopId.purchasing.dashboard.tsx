import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line,
} from "recharts";
import { useShop } from "@/components/shop/ShopLayout";
import {
  PageContainer, PageHeader, SectionCard, StatCard, DataTableShell, StatusBadge,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { purchasingDashboard } from "@/lib/purchasing.functions";
import {
  ArrowLeft, ShoppingCart, Euro, TrendingUp, Clock, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/purchasing/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord Achats — BPEI" },
      { name: "description", content: "Vue d'ensemble des bons de commande : évolution mensuelle, top fournisseurs, fiabilité." },
    ],
  }),
  component: PurchasingDashboardPage,
});

const PO_STATUS: Record<string, { label: string; tone: "muted" | "info" | "warning" | "success" | "destructive" }> = {
  draft: { label: "Brouillon", tone: "muted" },
  sent: { label: "Envoyé", tone: "info" },
  confirmed: { label: "Confirmé", tone: "info" },
  partial: { label: "Partiel", tone: "warning" },
  late: { label: "En retard", tone: "warning" },
  received: { label: "Reçu", tone: "success" },
  cancelled: { label: "Annulé", tone: "destructive" },
  closed_variance: { label: "Clôturé (écart)", tone: "destructive" },
};

type Period = "1m" | "3m" | "6m" | "12m" | "ytd";

function periodRange(p: Period): { fromISO: string; toISO: string } {
  const to = new Date();
  const from = new Date(to);
  if (p === "1m") from.setMonth(to.getMonth() - 1);
  else if (p === "3m") from.setMonth(to.getMonth() - 3);
  else if (p === "6m") from.setMonth(to.getMonth() - 6);
  else if (p === "12m") from.setMonth(to.getMonth() - 12);
  else if (p === "ytd") { from.setMonth(0); from.setDate(1); from.setHours(0, 0, 0, 0); }
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

function PurchasingDashboardPage() {
  const ctx = useShop();
  const shopId = ctx.shopId;
  const [period, setPeriod] = useState<Period>("12m");
  const range = useMemo(() => periodRange(period), [period]);
  const fetchDash = useServerFn(purchasingDashboard);

  const dashQ = useQuery({
    queryKey: ["purchasing", "dashboard", shopId, period],
    queryFn: () => fetchDash({ data: { shopId, ...range } }),
  });

  const d = dashQ.data;

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Achats"
        title="Tableau de bord"
        description="Évolution mensuelle, top fournisseurs et indicateurs de fiabilité."
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">30 derniers jours</SelectItem>
                <SelectItem value="3m">3 derniers mois</SelectItem>
                <SelectItem value="6m">6 derniers mois</SelectItem>
                <SelectItem value="12m">12 derniers mois</SelectItem>
                <SelectItem value="ytd">Depuis le 1er janvier</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" asChild>
              <Link to="/app/shop/$shopId/purchasing" params={{ shopId }}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Retour
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Bons valorisés"
          value={dashQ.isLoading ? "…" : String(d?.kpis.ordersCount ?? 0)}
          hint="envoyés, reçus, partiels, clôturés"
        />
        <StatCard
          icon={<Euro className="h-4 w-4" />}
          label="Montant total HT"
          value={dashQ.isLoading ? "…" : formatMoney(d?.kpis.totalHtCents ?? 0)}
          hint={`TTC : ${formatMoney(d?.kpis.totalTtcCents ?? 0)}`}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Panier moyen HT"
          value={dashQ.isLoading ? "…" : formatMoney(d?.kpis.avgOrderHtCents ?? 0)}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Livraisons à l'heure"
          value={
            dashQ.isLoading ? "…"
              : d?.kpis.onTimeRate == null ? "—"
                : `${d.kpis.onTimeRate}%`
          }
          hint={d?.kpis.avgDelayDays ? `retard moyen : ${d.kpis.avgDelayDays} j` : "aucun retard"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="En retard (ouverts)"
          value={String(d?.kpis.lateOpen ?? 0)}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Clôturés avec écart"
          value={String(d?.kpis.varianceClosed ?? 0)}
        />
        <StatCard
          icon={<XCircle className="h-4 w-4" />}
          label="Annulés"
          value={String(d?.byStatus?.cancelled?.count ?? 0)}
        />
      </div>

      <SectionCard title="Évolution mensuelle" description="Montant HT et nombre de bons par mois">
        {dashQ.isLoading ? (
          <div className="h-64 animate-pulse rounded-md bg-muted" />
        ) : !d || d.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune donnée sur la période.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.months.map(m => ({ ...m, ht: m.ht_cents / 100 }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${v}€`} />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(2)} €`, "Montant HT"]}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Bar dataKey="ht" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.months}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, "Bons de commande"]}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Répartition par statut">
        {dashQ.isLoading ? (
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        ) : !d || Object.keys(d.byStatus).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun bon sur la période.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(d.byStatus).map(([status, agg]) => {
              const meta = PO_STATUS[status] ?? { label: status, tone: "muted" as const };
              return (
                <div key={status} className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <StatusBadge status={status} tone={meta.tone} label={meta.label} />
                  <div className="text-sm">
                    <div className="font-semibold">{agg.count} bon{agg.count > 1 ? "s" : ""}</div>
                    <div className="text-xs text-muted-foreground">{formatMoney(agg.ht_cents)} HT</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Top fournisseurs" description="Classés par montant HT commandé sur la période">
        {dashQ.isLoading ? (
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        ) : !d || d.topSuppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun fournisseur sur la période.</p>
        ) : (
          <DataTableShell>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Fournisseur</th>
                  <th className="p-2 text-right">Bons</th>
                  <th className="p-2 text-right">Montant HT</th>
                  <th className="p-2 text-right">Panier moyen</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {d.topSuppliers.map((s) => (
                  <tr key={s.supplier_id} className="border-t">
                    <td className="p-2 font-medium">{s.name}</td>
                    <td className="p-2 text-right">{s.count}</td>
                    <td className="p-2 text-right">{formatMoney(s.ht_cents)}</td>
                    <td className="p-2 text-right">{formatMoney(Math.round(s.ht_cents / s.count))}</td>
                    <td className="p-2 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to="/app/shop/$shopId/purchasing/suppliers/$supplierId"
                          params={{ shopId, supplierId: s.supplier_id }}
                        >
                          Fiche
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        )}
      </SectionCard>
    </PageContainer>
  );
}