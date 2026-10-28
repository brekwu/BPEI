import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { listShopActivity } from "@/lib/notifications.functions";
import { PageContainer, PageHeader, SectionCard, EmptyState, Skeleton } from "@/components/ui-kit";
import { History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/activity")({
  head: () => ({ meta: [{ title: "Historique — BPEI" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { shopId } = useShop();
  const listFn = useServerFn(listShopActivity);
  const q = useQuery({
    queryKey: ["shop-activity", shopId],
    queryFn: () => listFn({ data: { shopId, limit: 300 } }),
  });
  const rows = q.data ?? [];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Boutique"
        title="Historique global"
        description="Journal des dernières actions effectuées dans votre boutique par vos équipes."
      />
      <SectionCard title="Activité récente">
        {q.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="Aucune activité enregistrée" description="Les actions apparaîtront ici au fil des jours." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Quand</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Entité</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: fr })}
                    </td>
                    <td className="py-2 pr-3">{r.entity_type ?? "—"}</td>
                    <td className="py-2 pr-3 font-medium">{r.action}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{r.entity_id ?? "—"}</td>
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