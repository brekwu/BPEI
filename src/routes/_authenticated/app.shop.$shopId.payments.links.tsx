import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { listPaymentLinks, cancelPaymentLink } from "@/lib/payment-links.functions";
import { formatMoney, formatDateTime } from "@/lib/money";
import { PageContainer, PageHeader, DataTableShell, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { toCsv, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/payments/links")({
  head: () => ({ meta: [{ title: "Liens de paiement — BPEI" }] }),
  component: PaymentLinksList,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente", paid: "Payé", expired: "Expiré", cancelled: "Annulé",
};

function PaymentLinksList() {
  const ctx = useShop();
  const qc = useQueryClient();
  const listFn = useServerFn(listPaymentLinks);
  const cancelFn = useServerFn(cancelPaymentLink);
  const q = useQuery({
    queryKey: ["payment-links", ctx.shopId],
    queryFn: () => listFn({ data: { shopId: ctx.shopId } }),
  });

  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const rows = useMemo(() => {
    const all = (q.data ?? []) as any[];
    return all.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (from && r.created_at < from) return false;
      if (to && r.created_at > to + "T23:59:59Z") return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(r.bank_reference ?? "").toLowerCase().includes(s) && !(r.label ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [q.data, status, from, to, search]);

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/pay/${token}`);
    toast.success("Lien copié");
  }
  async function cancel(id: string) {
    await cancelFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["payment-links", ctx.shopId] });
    toast.success("Lien annulé");
  }
  function exportCsv() {
    const data = rows.map((r: any) => ({
      cree_le: r.created_at,
      reference: r.bank_reference,
      libelle: r.label ?? "",
      statut: STATUS_LABEL[r.status] ?? r.status,
      echeance: r.expires_at ?? "",
      paye_le: r.paid_at ?? "",
      montant: (r.amount_cents / 100).toFixed(2),
      devise: r.currency,
      url: `${window.location.origin}/pay/${r.token}`,
    }));
    downloadCsv(`liens-paiement-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data));
  }

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Finance"
        title="Liens de paiement"
        description="Liens à envoyer à vos clients pour paiement par virement."
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div><Label className="text-xs">Statut</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label className="text-xs">Recherche</Label><Input placeholder="Référence / libellé" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <DataTableShell
        loading={q.isLoading}
        empty={rows.length === 0}
        emptyIcon={<Link2 className="h-5 w-5" />}
        emptyTitle="Aucun lien"
        emptyDescription="Ajustez les filtres ou générez un lien depuis une facture."
      >
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Créé le</th>
              <th className="px-4 py-2.5 text-left font-medium">Référence</th>
              <th className="px-4 py-2.5 text-left font-medium">Libellé</th>
              <th className="px-4 py-2.5 text-left font-medium">Statut</th>
              <th className="px-4 py-2.5 text-left font-medium">Échéance</th>
              <th className="px-4 py-2.5 text-right font-medium">Montant</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r: any) => (
              <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-2.5 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.bank_reference}</td>
                <td className="px-4 py-2.5">{r.label ?? "—"}</td>
                <td className="px-4 py-2.5"><StatusBadge status={r.status} label={STATUS_LABEL[r.status] ?? r.status} /></td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.expires_at ? formatDateTime(r.expires_at) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMoney(r.amount_cents, r.currency)}</td>
                <td className="px-4 py-2.5 text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => copyLink(r.token)}><Copy className="h-3.5 w-3.5" /></Button>
                  {r.status === "pending" && <Button size="sm" variant="ghost" onClick={() => cancel(r.id)}>Annuler</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </PageContainer>
  );
}