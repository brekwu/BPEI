import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { listReviews, moderateReview } from "@/lib/appointments.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Star, MessageSquareReply, Eye, EyeOff, X, MessageSquare } from "lucide-react";
import {
  PageContainer, PageHeader, SectionCard, StatCard, EmptyState, Skeleton,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/reviews")({
  head: () => ({ meta: [{ title: "Avis — BPEI" }] }),
  component: ReviewsPage,
});

function Stars({ n }: { n: number }) {
  return (
    <div className="inline-flex" aria-label={`${n} sur 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < n ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function ReviewsPage() {
  const { shopId } = useShop();
  const qc = useQueryClient();
  const listFn = useServerFn(listReviews);
  const modFn = useServerFn(moderateReview);
  const [filter, setFilter] = useState<"all" | "pending" | "published" | "rejected">("all");

  const q = useQuery({
    queryKey: ["reviews", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });

  const rows = q.data ?? [];
  const filtered = rows.filter((r) => filter === "all" ? true : r.status === filter);
  const published = rows.filter((r) => r.status === "published");
  const pending = rows.filter((r) => r.status === "pending").length;
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;

  const modMut = useMutation({
    mutationFn: (input: { id: string; status: "published" | "rejected" | "pending"; reply?: string | null }) => modFn({ data: input }),
    onSuccess: () => { toast.success("Enregistré"); qc.invalidateQueries({ queryKey: ["reviews", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Boutique"
        title="Avis clients"
        description="Modérez, publiez et répondez. Vous ne pouvez pas modifier le contenu écrit par le client."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Note moyenne"
          value={
            <span className="flex items-baseline gap-2">
              {avg.toFixed(1)}
              <Stars n={Math.round(avg)} />
            </span>
          }
          hint={`${published.length} avis publiés`}
          icon={<Star className="h-5 w-5" />}
          accent="warning"
        />
        <StatCard label="En attente" value={pending} accent={pending ? "warning" : "default"} />
        <StatCard label="Total" value={rows.length} />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="published">Publiés</TabsTrigger>
          <TabsTrigger value="rejected">Rejetés</TabsTrigger>
        </TabsList>
      </Tabs>

      {q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="Aucun avis"
          description="Les avis apparaîtront ici après validation par le client."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ReviewCard key={r.id} r={r} onAction={(input) => modMut.mutate(input)} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function ReviewCard({ r, onAction }: { r: any; onAction: (input: { id: string; status: "published" | "rejected" | "pending"; reply?: string | null }) => void }) {
  const [reply, setReply] = useState(r.reply_text ?? "");
  const [showReply, setShowReply] = useState(false);
  return (
    <SectionCard>
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Stars n={r.rating} />
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {r.status === "pending" ? "En attente" : r.status === "published" ? "Publié" : "Rejeté"}
              </span>
            </div>
            <div className="mt-1 font-semibold text-foreground">{r.title || "Sans titre"}</div>
            <div className="text-xs text-muted-foreground">
              {r.author_name} · {new Date(r.created_at).toLocaleDateString("fr-FR", { dateStyle: "long" })}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {r.status !== "published" && (
              <Button size="sm" variant="outline" onClick={() => onAction({ id: r.id, status: "published" })}>
                <Eye className="mr-1 h-3.5 w-3.5" />Publier
              </Button>
            )}
            {r.status === "published" && (
              <Button size="sm" variant="outline" onClick={() => onAction({ id: r.id, status: "pending" })}>
                <EyeOff className="mr-1 h-3.5 w-3.5" />Masquer
              </Button>
            )}
            {r.status !== "rejected" && (
              <Button size="sm" variant="ghost" onClick={() => onAction({ id: r.id, status: "rejected" })}>
                <X className="mr-1 h-3.5 w-3.5" />Rejeter
              </Button>
            )}
          </div>
        </div>
        {r.comment && <p className="whitespace-pre-wrap text-sm text-foreground">{r.comment}</p>}

        {r.reply_text && !showReply && (
          <div className="rounded-lg border border-electric/30 bg-electric-soft p-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-electric">Réponse boutique</div>
            <div className="text-sm text-foreground">{r.reply_text}</div>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setShowReply(true)}>Modifier</Button>
          </div>
        )}
        {(showReply || !r.reply_text) && (
          <div className="space-y-2">
            <Textarea rows={2} placeholder="Réponse de la boutique…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { onAction({ id: r.id, status: r.status === "pending" ? "published" : r.status, reply: reply || null }); setShowReply(false); }}>
                <MessageSquareReply className="mr-1 h-3.5 w-3.5" />Enregistrer la réponse
              </Button>
              {showReply && <Button size="sm" variant="ghost" onClick={() => setShowReply(false)}>Annuler</Button>}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}