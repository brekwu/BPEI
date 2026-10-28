import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { listQuotes, createQuoteDraft } from "@/lib/quotes.functions";
import {
  PageContainer, PageHeader, DataTableShell,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { QuoteStatusBadge } from "@/components/shop/DocumentStatusBadge";
import { formatMoney, formatDate } from "@/lib/money";
import { FileText, Plus } from "lucide-react";
import { canManageShop } from "@/lib/shop-constants";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/quotes/")({
  head: () => ({ meta: [{ title: "Devis — BPEI" }] }),
  component: QuotesList,
});

function QuotesList() {
  const ctx = useShop();
  const qc = useQueryClient();
  const nav = useNavigate();
  const list = useServerFn(listQuotes);
  const create = useServerFn(createQuoteDraft);

  const q = useQuery({
    queryKey: ["quotes", ctx.shopId],
    queryFn: () => list({ data: { shopId: ctx.shopId } }),
  });

  const createDraft = useMutation({
    mutationFn: () => create({ data: { shopId: ctx.shopId } }),
    onSuccess: (row: any) => {
      qc.invalidateQueries({ queryKey: ["quotes", ctx.shopId] });
      nav({ to: "/app/shop/$shopId/quotes/$quoteId", params: { shopId: ctx.shopId, quoteId: row.id } });
    },
  });

  const canCreate = canManageShop(ctx.role) || ctx.role !== "admin_bpei";
  const rows = q.data ?? [];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Boutique"
        title="Devis"
        description="Historique complet et brouillons en cours."
        actions={
          canCreate ? (
            <Button onClick={() => createDraft.mutate()} disabled={createDraft.isPending}>
              <Plus className="mr-2 h-4 w-4" />Nouveau devis
            </Button>
          ) : null
        }
      />

      <DataTableShell
        loading={q.isLoading}
        empty={rows.length === 0}
        emptyIcon={<FileText className="h-5 w-5" />}
        emptyTitle="Aucun devis"
        emptyDescription="Créez votre premier devis pour proposer une intervention à un client."
        emptyAction={canCreate ? (
          <Button onClick={() => createDraft.mutate()} disabled={createDraft.isPending}>
            <Plus className="mr-2 h-4 w-4" />Nouveau devis
          </Button>
        ) : undefined}
      >
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">N°</th>
              <th className="px-4 py-2.5 text-left font-medium">Date</th>
              <th className="px-4 py-2.5 text-left font-medium">Validité</th>
              <th className="px-4 py-2.5 text-left font-medium">Statut</th>
              <th className="px-4 py-2.5 text-right font-medium">Total TTC</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r: any) => (
              <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-2.5 font-medium">{r.quote_number ?? <span className="text-muted-foreground">Brouillon</span>}</td>
                <td className="px-4 py-2.5">{formatDate(r.issue_date ?? r.created_at)}</td>
                <td className="px-4 py-2.5">{formatDate(r.valid_until)}</td>
                <td className="px-4 py-2.5"><QuoteStatusBadge status={r.status} /></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(r.total_including_tax_cents, r.currency)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/app/shop/$shopId/quotes/$quoteId" params={{ shopId: ctx.shopId, quoteId: r.id }}>Ouvrir</Link>
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