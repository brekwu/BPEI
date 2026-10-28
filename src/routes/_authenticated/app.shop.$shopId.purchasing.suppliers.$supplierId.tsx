import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import {
  PageContainer, PageHeader, SectionCard, StatCard, DataTableShell, StatusBadge,
} from "@/components/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import {
  getSupplier, getSupplierStats, listSupplierPurchaseOrders,
  listSupplierItems, listSupplierPriceHistory,
} from "@/lib/purchasing.functions";
import {
  Truck, ArrowLeft, Euro, ShoppingCart, TrendingUp, TrendingDown,
  CheckCircle2, AlertTriangle, Package, History, Info, Mail, Phone, MapPin, Globe,
  ShieldCheck, ShieldAlert, Shield,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/purchasing/suppliers/$supplierId")({
  head: () => ({
    meta: [
      { title: "Fournisseur — BPEI" },
      { name: "description", content: "Fiche fournisseur détaillée : historique de commandes, articles liés, prix, fiabilité." },
    ],
  }),
  component: SupplierDetailPage,
});

const RELIABILITY: Record<string, { label: string; tone: "success" | "info" | "warning" | "muted"; icon: React.ReactNode }> = {
  reliable: { label: "Fournisseur fiable", tone: "success", icon: <ShieldCheck className="h-4 w-4" /> },
  generally_reliable: { label: "Globalement fiable", tone: "info", icon: <Shield className="h-4 w-4" /> },
  to_watch: { label: "À surveiller", tone: "warning", icon: <ShieldAlert className="h-4 w-4" /> },
  insufficient_data: { label: "Données insuffisantes", tone: "muted", icon: <Info className="h-4 w-4" /> },
};

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

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}
function fmtNum(n: number | null | undefined, suffix = "") {
  if (n == null) return "—";
  return `${n}${suffix}`;
}

function SupplierDetailPage() {
  const ctx = useShop();
  const { supplierId } = Route.useParams();
  const shopId = ctx.shopId;

  const getS = useServerFn(getSupplier);
  const getStats = useServerFn(getSupplierStats);

  const sup = useQuery({
    queryKey: ["supplier-detail", shopId, supplierId],
    queryFn: () => getS({ data: { shopId, supplierId } }),
  });
  const stats = useQuery({
    queryKey: ["supplier-stats", shopId, supplierId],
    queryFn: () => getStats({ data: { shopId, supplierId } }),
  });

  const s: any = sup.data;
  const st: any = stats.data;
  const rel = st ? (RELIABILITY[st.reliability] ?? RELIABILITY.insufficient_data) : null;

  return (
    <PageContainer size="wide">
      <PageHeader
        title={s?.name ?? "Chargement…"}
        description={s ? [s.contact_name, s.email].filter(Boolean).join(" · ") : ""}
        actions={
          <Button asChild variant="outline">
            <Link to="/app/shop/$shopId/purchasing" params={{ shopId }}>
              <ArrowLeft className="mr-2 h-4 w-4" />Retour
            </Link>
          </Button>
        }
      />

      {sup.isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {sup.error && <p className="text-sm text-destructive">{(sup.error as Error).message}</p>}

      {s && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            <StatCard label="Montant total acheté (TTC)" value={st ? formatMoney(st.total_cents) : "—"} icon={<Euro className="h-4 w-4" />} />
            <StatCard label="Cette année" value={st ? formatMoney(st.year_cents) : "—"} icon={<TrendingUp className="h-4 w-4" />} />
            <StatCard label="Bons de commande" value={st?.order_count ?? "—"} icon={<ShoppingCart className="h-4 w-4" />} />
            <StatCard
              label="Fiabilité"
              value={rel ? rel.label : "—"}
              icon={rel?.icon ?? <Info className="h-4 w-4" />}
            />
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="overview"><Info className="mr-1.5 h-4 w-4" />Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="orders"><ShoppingCart className="mr-1.5 h-4 w-4" />Bons de commande</TabsTrigger>
              <TabsTrigger value="items"><Package className="mr-1.5 h-4 w-4" />Articles</TabsTrigger>
              <TabsTrigger value="prices"><TrendingDown className="mr-1.5 h-4 w-4" />Historique prix</TabsTrigger>
              <TabsTrigger value="contact"><Mail className="mr-1.5 h-4 w-4" />Contact</TabsTrigger>
              <TabsTrigger value="notes"><History className="mr-1.5 h-4 w-4" />Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview"><OverviewTab supplier={s} stats={st} /></TabsContent>
            <TabsContent value="orders"><OrdersTab shopId={shopId} supplierId={supplierId} /></TabsContent>
            <TabsContent value="items"><ItemsTab shopId={shopId} supplierId={supplierId} /></TabsContent>
            <TabsContent value="prices"><PricesTab shopId={shopId} supplierId={supplierId} /></TabsContent>
            <TabsContent value="contact"><ContactTab supplier={s} /></TabsContent>
            <TabsContent value="notes">
              <SectionCard>
                <div className="p-4 text-sm whitespace-pre-line text-muted-foreground">
                  {s.notes || "Aucune note interne."}
                </div>
              </SectionCard>
            </TabsContent>
          </Tabs>
        </>
      )}
    </PageContainer>
  );
}

function OverviewTab({ supplier, stats }: { supplier: any; stats: any }) {
  const rel = stats ? (RELIABILITY[stats.reliability] ?? RELIABILITY.insufficient_data) : null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard title="Indicateur de fiabilité">
        <div className="p-4 space-y-3">
          {rel && <StatusBadge status={stats.reliability} label={rel.label} tone={rel.tone} />}
          <div className="text-sm space-y-1.5">
            <Row label="Bons livrés à temps" value={fmtNum(stats?.full_rate_pct, "%")} good={stats?.full_rate_pct != null && stats.full_rate_pct >= 90} />
            <Row label="Bons en retard" value={fmtNum(stats?.late_rate_pct, "%")} bad={stats?.late_rate_pct != null && stats.late_rate_pct > 25} />
            <Row label="Délai moyen constaté" value={fmtNum(stats?.avg_lead_days, " j")} />
            <Row label="Retard moyen (quand en retard)" value={fmtNum(stats?.avg_delay_days, " j")} />
            <Row label="Bons clôturés avec écart" value={stats?.variance_count ?? 0} bad={(stats?.variance_count ?? 0) > 0} />
          </div>
          {stats?.reliability === "insufficient_data" && (
            <p className="text-xs text-muted-foreground border-l-2 border-border pl-2">
              Moins de 5 bons de commande finalisés : les indicateurs ne sont pas assez représentatifs pour un score de fiabilité.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Conditions commerciales">
        <div className="p-4 text-sm space-y-1.5">
          <Row label="Délai livraison par défaut" value={supplier.default_lead_days != null ? `${supplier.default_lead_days} j` : "—"} />
          <Row label="Conditions de paiement" value={supplier.payment_terms || "—"} />
          <Row label="Numéro TVA" value={supplier.vat_number || "—"} />
          <Row label="État" value={supplier.archived_at ? "Archivé" : supplier.active ? "Actif" : "Désactivé"} />
        </div>
      </SectionCard>

      <SectionCard title="Chiffres clés" className="md:col-span-2">
        <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <KpiBlock label="Commandes totales" value={stats?.order_count ?? "—"} icon={<ShoppingCart className="h-4 w-4" />} />
          <KpiBlock label="Reçues complètes" value={stats?.received_count ?? "—"} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
          <KpiBlock label="Partielles en cours" value={stats?.partial_count ?? "—"} icon={<AlertTriangle className="h-4 w-4 text-warning" />} />
          <KpiBlock label="Achats du mois en cours" value={stats ? formatMoney(stats.month_cents) : "—"} icon={<Euro className="h-4 w-4" />} />
        </div>
      </SectionCard>
    </div>
  );
}

function Row({ label, value, good, bad }: { label: string; value: React.ReactNode; good?: boolean; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums font-medium ${good ? "text-success" : bad ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}
function KpiBlock({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function OrdersTab({ shopId, supplierId }: { shopId: string; supplierId: string }) {
  const fn = useServerFn(listSupplierPurchaseOrders);
  const q = useQuery({
    queryKey: ["supplier-orders", shopId, supplierId],
    queryFn: () => fn({ data: { shopId, supplierId } }),
  });
  const rows = (q.data ?? []) as any[];
  return (
    <SectionCard>
      <DataTableShell
        loading={q.isLoading}
        empty={!q.isLoading && rows.length === 0}
        emptyIcon={<ShoppingCart className="h-6 w-6" />}
        emptyTitle="Aucun bon de commande"
        emptyDescription="Ce fournisseur n'a encore aucun bon enregistré."
      >
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Référence</th>
              <th className="px-4 py-3 font-medium">Commande</th>
              <th className="px-4 py-3 font-medium">Prévu</th>
              <th className="px-4 py-3 font-medium">Reçu</th>
              <th className="px-4 py-3 font-medium text-right">HT</th>
              <th className="px-4 py-3 font-medium text-right">TTC</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const s = PO_STATUS[r.status] ?? { label: r.status, tone: "muted" as const };
              const late = r.status === "received" && r.expected_date && r.received_date && new Date(r.received_date) > new Date(r.expected_date);
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.reference}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.order_date)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.expected_date)}</td>
                  <td className={`px-4 py-3 text-xs ${late ? "text-warning" : "text-muted-foreground"}`}>{fmtDate(r.received_date)}{late && " (retard)"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatMoney(r.total_ht_cents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(r.total_ttc_cents)}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} label={s.label} tone={s.tone} size="sm" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </SectionCard>
  );
}

function ItemsTab({ shopId, supplierId }: { shopId: string; supplierId: string }) {
  const fn = useServerFn(listSupplierItems);
  const q = useQuery({
    queryKey: ["supplier-items", shopId, supplierId],
    queryFn: () => fn({ data: { shopId, supplierId } }),
  });
  const rows = (q.data ?? []) as any[];
  return (
    <SectionCard>
      <DataTableShell
        loading={q.isLoading}
        empty={!q.isLoading && rows.length === 0}
        emptyIcon={<Package className="h-6 w-6" />}
        emptyTitle="Aucun article lié"
        emptyDescription="Aucun article de stock n'utilise ce fournisseur."
      >
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Article</th>
              <th className="px-4 py-3 font-medium">Réf. fournisseur</th>
              <th className="px-4 py-3 font-medium text-right">Prix HT</th>
              <th className="px-4 py-3 font-medium text-right">Délai</th>
              <th className="px-4 py-3 font-medium text-right">Stock</th>
              <th className="px-4 py-3 font-medium">Principal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.stock_item?.name ?? "—"}</div>
                  {r.stock_item?.sku && <div className="text-xs text-muted-foreground">{r.stock_item.sku}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.supplier_product_reference || "—"}
                  {r.supplier_product_name && <div className="text-xs">{r.supplier_product_name}</div>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.purchase_price_cents)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.estimated_delivery_days != null ? `${r.estimated_delivery_days} j` : "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.stock_item?.quantity ?? "—"}</td>
                <td className="px-4 py-3">
                  {r.is_primary ? <StatusBadge status="primary" label="Principal" tone="info" size="sm" /> : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </SectionCard>
  );
}

function PricesTab({ shopId, supplierId }: { shopId: string; supplierId: string }) {
  const fn = useServerFn(listSupplierPriceHistory);
  const q = useQuery({
    queryKey: ["supplier-prices", shopId, supplierId],
    queryFn: () => fn({ data: { shopId, supplierId } }),
  });
  const rows = (q.data ?? []) as any[];
  return (
    <SectionCard>
      <DataTableShell
        loading={q.isLoading}
        empty={!q.isLoading && rows.length === 0}
        emptyIcon={<History className="h-6 w-6" />}
        emptyTitle="Aucun changement de prix"
        emptyDescription="L'historique se remplit à chaque réception avec un prix différent du prix enregistré."
      >
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Article</th>
              <th className="px-4 py-3 font-medium text-right">Ancien</th>
              <th className="px-4 py-3 font-medium text-right">Nouveau</th>
              <th className="px-4 py-3 font-medium text-right">Variation</th>
              <th className="px-4 py-3 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const diff = (r.new_price_cents ?? 0) - (r.old_price_cents ?? 0);
              const pct = r.old_price_cents ? Math.round((diff / r.old_price_cents) * 1000) / 10 : null;
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.changed_at).toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.stock_item?.name ?? "—"}</div>
                    {r.stock_item?.sku && <div className="text-xs text-muted-foreground">{r.stock_item.sku}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{r.old_price_cents != null ? formatMoney(r.old_price_cents) : "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(r.new_price_cents)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${diff > 0 ? "text-destructive" : diff < 0 ? "text-success" : "text-muted-foreground"}`}>
                    {diff > 0 ? "+" : ""}{formatMoney(diff)}{pct != null && ` (${pct > 0 ? "+" : ""}${pct}%)`}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.source}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </SectionCard>
  );
}

function ContactTab({ supplier }: { supplier: any }) {
  return (
    <SectionCard>
      <div className="p-4 grid gap-3 sm:grid-cols-2 text-sm">
        <ContactRow icon={<Truck className="h-4 w-4" />} label="Contact" value={supplier.contact_name} />
        <ContactRow icon={<Mail className="h-4 w-4" />} label="Email" value={supplier.email} href={supplier.email ? `mailto:${supplier.email}` : undefined} />
        <ContactRow icon={<Phone className="h-4 w-4" />} label="Téléphone" value={supplier.phone} href={supplier.phone ? `tel:${supplier.phone}` : undefined} />
        <ContactRow icon={<Globe className="h-4 w-4" />} label="Site web" value={supplier.website} href={supplier.website ?? undefined} external />
        <ContactRow icon={<MapPin className="h-4 w-4" />} label="Adresse" value={supplier.address} />
      </div>
    </SectionCard>
  );
}

function ContactRow({ icon, label, value, href, external }: { icon: React.ReactNode; label: string; value: string | null; href?: string; external?: boolean }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        {value
          ? href
            ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="text-sm font-medium hover:underline break-words">{value}</a>
            : <div className="text-sm font-medium break-words whitespace-pre-line">{value}</div>
          : <div className="text-sm text-muted-foreground">—</div>}
      </div>
    </div>
  );
}