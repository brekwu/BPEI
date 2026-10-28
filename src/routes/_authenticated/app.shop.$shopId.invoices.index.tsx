import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { listInvoices } from "@/lib/invoices.functions";
import { formatMoney, formatDate } from "@/lib/money";
import { InvoiceStatusBadge } from "@/components/shop/DocumentStatusBadge";
import {
  PageContainer, PageHeader, DataTableShell,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/invoices/")({
  head: () => ({ meta: [{ title: "Factures — BPEI" }] }),
  component: InvoicesList,
});

function InvoicesList() {
  const ctx = useShop();
  const list = useServerFn(listInvoices);
  const q = useQuery({
    queryKey: ["invoices", ctx.shopId],
    queryFn: () => list({ data: { shopId: ctx.shopId } }),
  });
  const rows = q.data ?? [];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Boutique"
        title="Factures"
        description="Factures émises, brouillons et suivi des paiements."
      />

      <DataTableShell
        loading={q.isLoading}
        empty={rows.length === 0}
        emptyIcon={<Receipt className="h-5 w-5" />}
        emptyTitle="Aucune facture"
        emptyDescription="Les factures apparaissent ici dès qu'un devis est converti ou qu'une réparation est facturée."
      >
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">N°</th>
              <th className="px-4 py-2.5 text-left font-medium">Date</th>
              <th className="px-4 py-2.5 text-left font-medium">Échéance</th>
              <th className="px-4 py-2.5 text-left font-medium">Statut</th>
              <th className="px-4 py-2.5 text-right font-medium">Total TTC</th>
              <th className="px-4 py-2.5 text-right font-medium">Payé</th>
              <th className="px-4 py-2.5 text-right font-medium">Solde</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r: any) => (
              <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-2.5 font-medium">{r.invoice_number ?? <span className="text-muted-foreground">Brouillon</span>}</td>
                <td className="px-4 py-2.5">{formatDate(r.issue_date ?? r.created_at)}</td>
                <td className="px-4 py-2.5">{formatDate(r.due_date)}</td>
                <td className="px-4 py-2.5"><InvoiceStatusBadge status={r.status} /></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.total_including_tax_cents, r.currency)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.amount_paid_cents, r.currency)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.amount_due_cents, r.currency)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/app/shop/$shopId/invoices/$invoiceId" params={{ shopId: ctx.shopId, invoiceId: r.id }}>Ouvrir</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </PageContainer>
  );
}