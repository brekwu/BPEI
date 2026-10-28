import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { getFinanceStats } from "@/lib/finance-stats.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance-constants";
import {
  PageContainer, PageHeader, SectionCard, StatCard, EmptyState, Skeleton,
} from "@/components/ui-kit";
import {
  TrendingUp, Wallet, AlertCircle, ShoppingBag,
  Send, CheckCircle2, Target, FileMinus, CreditCard,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/finance")({
  head: () => ({ meta: [{ title: "Finance — BPEI" }] }),
  component: FinancePage,
});

function periodDates(preset: string) {
  const now = new Date();
  const to = now.toISOString();
  const start = new Date(now);
  switch (preset) {
    case "today": start.setHours(0, 0, 0, 0); break;
    case "week": start.setDate(now.getDate() - 7); break;
    case "quarter": start.setMonth(now.getMonth() - 3); break;
    case "year": start.setFullYear(now.getFullYear() - 1); break;
    default: start.setMonth(now.getMonth() - 1);
  }
  return { from: start.toISOString(), to };
}

function FinancePage() {
  const ctx = useShop();
  const [preset, setPreset] = useState("month");
  const { from, to } = periodDates(preset);
  const fn = useServerFn(getFinanceStats);
  const q = useQuery({
    queryKey: ["finance", ctx.shopId, preset],
    queryFn: () => fn({ data: { shopId: ctx.shopId, from, to } }),
  });
  const s: any = q.data ?? {};
  const paymentEntries = Object.entries(s.payments_by_method ?? {});

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Finance"
        title="Tableau financier"
        description="Chiffres calculés sur la période sélectionnée."
        actions={
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="week">7 derniers jours</SelectItem>
              <SelectItem value="month">30 derniers jours</SelectItem>
              <SelectItem value="quarter">3 derniers mois</SelectItem>
              <SelectItem value="year">12 derniers mois</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="CA facturé" value={formatMoney(s.revenue_issued)} hint={`${s.invoices_issued ?? 0} factures émises`} icon={<TrendingUp className="h-5 w-5" />} accent="electric" />
            <StatCard label="CA encaissé" value={formatMoney(s.revenue_collected)} icon={<Wallet className="h-5 w-5" />} accent="success" />
            <StatCard label="Restant à encaisser" value={formatMoney(s.outstanding)} hint={`${s.invoices_overdue ?? 0} en retard`} icon={<AlertCircle className="h-5 w-5" />} accent={s.invoices_overdue ? "warning" : "default"} />
            <StatCard label="Panier moyen" value={formatMoney(s.avg_basket)} icon={<ShoppingBag className="h-5 w-5" />} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Devis envoyés" value={String(s.quotes_sent ?? 0)} icon={<Send className="h-5 w-5" />} />
            <StatCard label="Devis acceptés" value={String(s.quotes_accepted ?? 0)} icon={<CheckCircle2 className="h-5 w-5" />} accent="success" />
            <StatCard label="Taux d'acceptation" value={`${s.acceptance_rate ?? 0} %`} icon={<Target className="h-5 w-5" />} />
            <StatCard label="Total avoirs" value={formatMoney(s.credit_notes_total)} icon={<FileMinus className="h-5 w-5" />} accent="destructive" />
          </div>

          <SectionCard title="Paiements par méthode" description="Répartition des encaissements sur la période.">
            {paymentEntries.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                title="Aucun paiement sur la période"
                description="Sélectionnez une période plus large pour voir apparaître des données."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {paymentEntries.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">{PAYMENT_METHOD_LABEL[k as keyof typeof PAYMENT_METHOD_LABEL]}</span>
                    <strong className="tabular-nums text-foreground">{formatMoney(v as number)}</strong>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      )}
    </PageContainer>
  );
}