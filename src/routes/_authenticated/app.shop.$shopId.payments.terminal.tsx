import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { PageContainer, PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard } from "lucide-react";
import { formatMoney, formatDateTime } from "@/lib/money";
import { listTerminalPayments } from "@/lib/terminal/invoice-checkout.functions";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/payments/terminal")({
  head: () => ({ meta: [{ title: "Historique TPE — BPEI" }] }),
  component: TerminalHistoryPage,
});

function TerminalHistoryPage() {
  const { shopId } = useShop();
  const fn = useServerFn(listTerminalPayments);
  const q = useQuery({ queryKey: ["terminal-payments", shopId], queryFn: () => fn({ data: { shopId, limit: 200 } }) });

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Historique paiements TPE"
        description="Toutes les transactions Stripe Terminal (test et live) de cette boutique."
      />
      <SectionCard padded={false}>
        {q.isLoading ? (
          <div className="p-6 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : (q.data ?? []).length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Aucun paiement TPE"
            description="Les encaissements réalisés via un terminal Stripe apparaîtront ici."
            className="border-0 rounded-none"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Montant</th>
                  <th className="p-3 text-left">Statut</th>
                  <th className="p-3 text-left">Carte</th>
                  <th className="p-3 text-left">Env.</th>
                  <th className="p-3 text-left">Facture</th>
                  <th className="p-3 text-left">Remboursé</th>
                </tr>
              </thead>
              <tbody>
                {(q.data as any[]).map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-3 whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                    <td className="p-3 tabular-nums font-medium">{formatMoney(p.amount_cents, p.currency)}</td>
                    <td className="p-3"><Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge>{p.local_state && p.status === "pending" && <span className="ml-2 text-xs text-muted-foreground">{p.local_state}</span>}</td>
                    <td className="p-3 text-xs">{p.card_brand ?? "—"}{p.card_last4 ? ` •••• ${p.card_last4}` : ""}</td>
                    <td className="p-3"><Badge variant={p.livemode ? "default" : "outline"}>{p.livemode ? "LIVE" : "TEST"}</Badge></td>
                    <td className="p-3 text-xs">
                      {p.invoice_id ? (
                        <Link to="/app/shop/$shopId/invoices/$invoiceId" params={{ shopId, invoiceId: p.invoice_id }} className="text-electric hover:underline">
                          Voir facture
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="p-3 tabular-nums text-xs">
                      {p.refunded_amount_cents ? formatMoney(p.refunded_amount_cents, p.currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case "confirmed": return "Confirmé";
    case "pending": return "En cours";
    case "failed": return "Échec";
    case "cancelled": return "Annulé";
    case "refunded": return "Remboursé";
    default: return s;
  }
}
function statusVariant(s: string): any {
  switch (s) {
    case "confirmed": return "default";
    case "failed":
    case "cancelled": return "destructive";
    case "refunded": return "outline";
    default: return "secondary";
  }
}