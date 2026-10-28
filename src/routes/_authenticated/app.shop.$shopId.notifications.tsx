import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import {
  listNotifications, markNotificationRead, markAllNotificationsRead,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, CheckCheck, Wrench, Calendar as CalendarIcon, Info } from "lucide-react";
import { PageContainer, PageHeader, SectionCard, EmptyState, Skeleton } from "@/components/ui-kit";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/notifications")({
  head: () => ({ meta: [{ title: "Notifications — BPEI" }] }),
  component: NotifsPage,
});

function iconFor(cat: string) {
  if (cat === "repair") return Wrench;
  if (cat === "appointment") return CalendarIcon;
  return Info;
}

function NotifsPage() {
  const { shopId } = useShop();
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const readFn = useServerFn(markNotificationRead);
  const allFn = useServerFn(markAllNotificationsRead);

  const q = useQuery({
    queryKey: ["notifications", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });

  const readMut = useMutation({
    mutationFn: (id: string) => readFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", shopId] }),
  });

  const allMut = useMutation({
    mutationFn: () => allFn({ data: { shopId } }),
    onSuccess: (r) => {
      toast.success(`${r.count} notification(s) marquée(s) comme lues`);
      qc.invalidateQueries({ queryKey: ["notifications", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  const unread = rows.filter((n) => !n.read_at).length;

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Boutique"
        title="Notifications"
        description="Alertes internes sur les réparations, rendez-vous et autres événements de votre boutique."
        actions={unread > 0 ? (
          <Button variant="outline" size="sm" onClick={() => allMut.mutate()} disabled={allMut.isPending}>
            <CheckCheck className="mr-2 h-4 w-4" />Tout marquer comme lu ({unread})
          </Button>
        ) : undefined}
      />
      <SectionCard title="Boîte de réception">
        {q.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Bell className="h-6 w-6" />} title="Aucune notification" description="Vos alertes s'afficheront ici." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((n) => {
              const Icon = iconFor(n.category);
              const body = (
                <div className={`flex items-start gap-3 py-3 ${!n.read_at ? "bg-electric-soft/40 -mx-2 px-2 rounded" : ""}`}>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-electric-soft text-electric">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{n.title}</div>
                    {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); readMut.mutate(n.id); }}
                      className="text-xs text-electric hover:underline"
                    >
                      Marquer lu
                    </button>
                  )}
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link_url ? (
                    <Link to={n.link_url} className="block hover:opacity-90" onClick={() => { if (!n.read_at) readMut.mutate(n.id); }}>
                      {body}
                    </Link>
                  ) : body}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}