import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ownerListPayments, ownerListPaymentLinks, ownerListShopsLite } from "@/lib/payment-links.functions";
import { formatMoney, formatDateTime } from "@/lib/money";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/finance-constants";
import { PageContainer, PageHeader, DataTableShell, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Link2, Download } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/owner/paiements")({
  head: () => ({ meta: [{ title: "Paiements réseau — Console patron" }] }),
  component: OwnerPayments,
});

const LINK_STATUS: Record<string, string> = {
  pending: "En attente", paid: "Payé", expired: "Expiré", cancelled: "Annulé",
};

function OwnerPayments() {
  const shopsFn = useServerFn(ownerListShopsLite);
  const payFn = useServerFn(ownerListPayments);
  const linkFn = useServerFn(ownerListPaymentLinks);

  const [shopId, setShopId] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [method, setMethod] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [linkStatus, setLinkStatus] = useState<string>("all");

  const shops = useQuery({ queryKey: ["owner-shops-lite"], queryFn: () => shopsFn({}) });

  const payments = useQuery({
    queryKey: ["owner-payments", shopId, from, to, method, status],
    queryFn: () => payFn({ data: {
      shopId: shopId === "all" ? null : shopId,
      from: from || null,
      to: to ? to + "T23:59:59Z" : null,
      method: method === "all" ? null : method,
      status: status === "all" ? null : status,
    } }),
  });
  const links = useQuery({
    queryKey: ["owner-payment-links", shopId, from, to, linkStatus],
    queryFn: () => linkFn({ data: {
      shopId: shopId === "all" ? null : shopId,
      from: from || null,
      to: to ? to + "T23:59:59Z" : null,
      status: linkStatus === "all" ? null : linkStatus,
    } }),
  });

  const payRows = (payments.data ?? []) as any[];
  const linkRows = (links.data ?? []) as any[];

  const totals = useMemo(() => {
    const confirmed = payRows.filter((p) => p.status === "confirmed");
    return {
      count: confirmed.length,
      amount: confirmed.reduce((s, p) => s + (p.amount_cents ?? 0), 0),
      pendingLinks: linkRows.filter((l) => l.status === "pending").length,
      paidLinks: linkRows.filter((l) => l.status === "paid").length,
    };
  }, [payRows, linkRows]);

  function exportPayments() {
    const data = payRows.map((p) => ({
      date: p.paid_at, boutique: p.shops?.name ?? "",
      methode: PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method,
      statut: PAYMENT_STATUS_LABEL[p.status as keyof typeof PAYMENT_STATUS_LABEL] ?? p.status,
      provider: p.provider ?? "internal",
      reference: p.reference ?? "",
      montant: (p.amount_cents / 100).toFixed(2), devise: p.currency,
    }));
    downloadCsv(`patron-paiements-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data));
  }
  function exportLinks() {
    const data = linkRows.map((r) => ({
      cree_le: r.created_at, boutique: r.shops?.name ?? "",
      reference: r.bank_reference, statut: LINK_STATUS[r.status] ?? r.status,
      echeance: r.expires_at ?? "", paye_le: r.paid_at ?? "",
      montant: (r.amount_cents / 100).toFixed(2), devise: r.currency,
    }));
    downloadCsv(`patron-liens-paiement-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data));
  }

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Console patron"
        title="Paiements réseau"
        description="Vue transverse des encaissements et liens de paiement sur toutes les boutiques."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <div className="col-span-2"><Label className="text-xs">Boutique</Label>
          <Select value={shopId} onValueChange={setShopId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les boutiques</SelectItem>
              {(shops.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label className="text-xs">Méthode</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Statut paiement</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi label="Encaissements confirmés" value={totals.count.toString()} />
        <Kpi label="Total encaissé" value={formatMoney(totals.amount, "EUR")} />
        <Kpi label="Liens en attente" value={totals.pendingLinks.toString()} />
        <Kpi label="Liens payés" value={totals.paidLinks.toString()} />
      </div>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments"><CreditCard className="mr-2 h-4 w-4" />Paiements</TabsTrigger>
          <TabsTrigger value="links"><Link2 className="mr-2 h-4 w-4" />Liens</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportPayments} disabled={payRows.length === 0}>
              <Download className="mr-2 h-4 w-4" />Exporter CSV
            </Button>
          </div>
          <DataTableShell
            loading={payments.isLoading}
            empty={payRows.length === 0}
            emptyIcon={<CreditCard className="h-5 w-5" />}
            emptyTitle="Aucun paiement"
            emptyDescription="Aucun paiement ne correspond aux filtres."
          >
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium">Boutique</th>
                  <th className="px-4 py-2.5 text-left font-medium">Méthode</th>
                  <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-left font-medium">Référence</th>
                  <th className="px-4 py-2.5 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payRows.map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDateTime(p.paid_at)}</td>
                    <td className="px-4 py-2.5">{p.shops?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={p.status} label={PAYMENT_STATUS_LABEL[p.status as keyof typeof PAYMENT_STATUS_LABEL] ?? p.status} /></td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.reference ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMoney(p.amount_cents, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </TabsContent>

        <TabsContent value="links" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="w-64">
              <Label className="text-xs">Statut lien</Label>
              <Select value={linkStatus} onValueChange={setLinkStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Object.entries(LINK_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={exportLinks} disabled={linkRows.length === 0}>
              <Download className="mr-2 h-4 w-4" />Exporter CSV
            </Button>
          </div>
          <DataTableShell
            loading={links.isLoading}
            empty={linkRows.length === 0}
            emptyIcon={<Link2 className="h-5 w-5" />}
            emptyTitle="Aucun lien"
            emptyDescription="Aucun lien de paiement ne correspond aux filtres."
          >
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Créé le</th>
                  <th className="px-4 py-2.5 text-left font-medium">Boutique</th>
                  <th className="px-4 py-2.5 text-left font-medium">Référence</th>
                  <th className="px-4 py-2.5 text-left font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-left font-medium">Échéance</th>
                  <th className="px-4 py-2.5 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {linkRows.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                    <td className="px-4 py-2.5">{r.shops?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{r.bank_reference}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} label={LINK_STATUS[r.status] ?? r.status} /></td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.expires_at ? formatDateTime(r.expires_at) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMoney(r.amount_cents, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </CardContent></Card>
  );
}