import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { listPayments } from "@/lib/payments.functions";
import { formatMoney, formatDateTime } from "@/lib/money";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/finance-constants";
import { PdfDownloadButton } from "@/components/shop/DownloadPdfButton";
import { getPaymentReceiptPdf } from "@/lib/documents-extra.functions";
import { PageContainer, PageHeader, DataTableShell, StatusBadge } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Download } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/payments")({
  head: () => ({ meta: [{ title: "Paiements — BPEI" }] }),
  component: PaymentsList,
});

function PaymentsList() {
  const ctx = useShop();
  const fn = useServerFn(listPayments);
  const q = useQuery({ queryKey: ["payments", ctx.shopId], queryFn: () => fn({ data: { shopId: ctx.shopId } }) });

  const [method, setMethod] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const rows = useMemo(() => {
    const all = (q.data ?? []) as any[];
    return all.filter((p) => {
      if (method !== "all" && p.method !== method) return false;
      if (status !== "all" && p.status !== status) return false;
      if (from && p.paid_at && p.paid_at < from) return false;
      if (to && p.paid_at && p.paid_at > to + "T23:59:59Z") return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(p.reference ?? "").toLowerCase().includes(s) && !(p.notes ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [q.data, method, status, from, to, search]);

  function exportCsv() {
    const data = rows.map((p: any) => ({
      date: p.paid_at,
      methode: PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL] ?? p.method,
      statut: PAYMENT_STATUS_LABEL[p.status as keyof typeof PAYMENT_STATUS_LABEL] ?? p.status,
      provider: p.provider ?? "internal",
      reference: p.reference ?? "",
      montant: (p.amount_cents / 100).toFixed(2),
      devise: p.currency,
      facture_id: p.invoice_id ?? "",
    }));
    downloadCsv(`paiements-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data));
  }

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Finance"
        title="Paiements"
        description="Encaissements enregistrés sur toutes les factures."
        actions={<Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}><Download className="mr-2 h-4 w-4" />Exporter CSV</Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div><Label className="text-xs">Méthode</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Statut</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Label className="text-xs">Recherche</Label><Input placeholder="Référence / notes" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <DataTableShell
        loading={q.isLoading}
        empty={rows.length === 0}
        emptyIcon={<CreditCard className="h-5 w-5" />}
        emptyTitle="Aucun paiement"
        emptyDescription="Ajustez les filtres ou enregistrez un premier paiement."
      >
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Date</th>
              <th className="px-4 py-2.5 text-left font-medium">Facture</th>
              <th className="px-4 py-2.5 text-left font-medium">Méthode</th>
              <th className="px-4 py-2.5 text-left font-medium">Statut</th>
              <th className="px-4 py-2.5 text-left font-medium">Référence</th>
              <th className="px-4 py-2.5 text-right font-medium">Montant</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p: any) => (
              <tr key={p.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-2.5 whitespace-nowrap">{formatDateTime(p.paid_at)}</td>
                <td className="px-4 py-2.5">
                  {p.invoice_id ? (
                    <Link to="/app/shop/$shopId/invoices/$invoiceId" params={{ shopId: ctx.shopId, invoiceId: p.invoice_id }} className="text-electric hover:underline">Voir</Link>
                  ) : "—"}
                </td>
                <td className="px-4 py-2.5">{PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}</td>
                <td className="px-4 py-2.5"><StatusBadge status={p.status} label={PAYMENT_STATUS_LABEL[p.status as keyof typeof PAYMENT_STATUS_LABEL]} /></td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.reference ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMoney(p.amount_cents, p.currency)}</td>
                <td className="px-4 py-2.5 text-right">
                  <PdfDownloadButton fn={getPaymentReceiptPdf} data={{ shopId: ctx.shopId, paymentId: p.id }} label="Reçu" fallbackFilename={`recu-${p.id.slice(0, 8)}.pdf`} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </PageContainer>
  );
}