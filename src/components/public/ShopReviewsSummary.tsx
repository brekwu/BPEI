import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { publicListShopReviews } from "@/lib/appointments.public.functions";
import { Star } from "lucide-react";

function Stars({ n, size = "h-3.5 w-3.5" }: { n: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${size} ${i < n ? "fill-warning text-warning" : "text-border"}`} />
      ))}
    </div>
  );
}

export function ShopReviewsSummary({ shopId }: { shopId: string }) {
  const fn = useServerFn(publicListShopReviews);
  const q = useQuery({
    queryKey: ["shop-public-reviews", shopId],
    queryFn: () => fn({ data: { shopId, limit: 10 } }),
  });
  if (q.isLoading) return null;
  const data = q.data;
  if (!data || data.count === 0) return null;
  const avg = data.average ?? 0;
  return (
    <div className="bpei-surface p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-3xl font-bold text-navy">{avg.toFixed(1)}</span>
            <Stars n={Math.round(avg)} size="h-5 w-5" />
          </div>
          <div className="text-xs text-muted-foreground mt-1">Basé sur {data.count} avis vérifiés</div>
        </div>
      </div>
      <div className="space-y-3 divide-y divide-border">
        {data.reviews.slice(0, 5).map((r) => (
          <div key={r.id} className="pt-3 first:pt-0">
            <div className="flex items-center gap-2 mb-1">
              <Stars n={r.rating} />
              <span className="text-xs text-muted-foreground">· {r.author_name}</span>
              {r.published_at && <span className="text-[10px] text-muted-foreground">{new Date(r.published_at).toLocaleDateString("fr-FR")}</span>}
            </div>
            {r.title && <div className="text-sm font-semibold">{r.title}</div>}
            {r.comment && <div className="text-sm text-muted-foreground line-clamp-3">{r.comment}</div>}
            {r.reply_text && (
              <div className="mt-2 rounded-md bg-surface-muted border-l-2 border-electric px-3 py-2 text-xs">
                <div className="font-semibold text-electric mb-0.5">Réponse de la boutique</div>
                <div className="text-muted-foreground">{r.reply_text}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}