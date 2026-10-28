import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { publicGetRepairStatus } from "@/lib/appointments.public.functions";
import { BPEILogo } from "@/components/BPEILogo";
import { ShopBrand } from "@/components/shop/ShopBrand";
import { RepairTimeline, publicRepairLabel } from "@/components/shop/RepairTimeline";
import { RepairStages } from "@/components/public/RepairStages";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Package, CheckCircle2, Share2, Navigation, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/suivi/$token")({
  head: () => ({
    meta: [
      { title: "Suivi de votre réparation — BPEI" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicRepairStatus,
});

function PublicRepairStatus() {
  const { token } = Route.useParams();
  const getFn = useServerFn(publicGetRepairStatus);
  const q = useQuery({
    queryKey: ["public-repair", token],
    queryFn: () => getFn({ data: { token } }),
    refetchInterval: 60_000,
  });

  if (q.isLoading) return <Splash>Chargement…</Splash>;
  if (!q.data) return (
    <Splash>
      <p className="font-semibold text-lg">Lien invalide ou expiré</p>
      <p className="text-sm text-muted-foreground mt-1">Contactez votre boutique pour un nouveau lien.</p>
      <Link to="/" className="text-electric text-sm underline mt-4 inline-block">Retour à BPEI</Link>
    </Splash>
  );

  const { repair, shop, history } = q.data;
  const ready = ["ready_for_pickup", "customer_notified"].includes(repair.status);
  const done = repair.status === "device_collected";

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `Suivi ${repair.repair_number}`, url }); } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(url); toast.success("Lien copié"); } catch { toast.error("Copie impossible"); }
    }
  }

  const mapsUrl = shop.city ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${shop.city}`)}` : null;

  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <ShopBrand shopId={shop.id} shopName={shop.name} size={40} variant="dark" />
          <Button size="sm" variant="ghost" onClick={share}><Share2 className="h-4 w-4 mr-1.5" />Partager</Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* Bloc statut principal */}
        <div className={`rounded-2xl p-6 text-center space-y-2 ${ready ? "bg-gradient-to-br from-success/20 via-success/10 to-transparent border-2 border-success" : done ? "bg-navy text-navy-foreground" : "bg-electric text-electric-foreground shadow-electric"}`}>
          {ready && <CheckCircle2 className="h-10 w-10 mx-auto text-success" />}
          <div className="text-xs uppercase tracking-widest opacity-80">Dossier {repair.repair_number}</div>
          <div className={`font-display text-2xl sm:text-3xl font-bold ${ready ? "text-success" : ""}`}>
            {publicRepairLabel(repair.status)}
          </div>
          {repair.estimated_completion_at && !done && !ready && (
            <div className="text-sm opacity-90 flex items-center justify-center gap-1.5">
              <Clock className="h-4 w-4" /> Prêt estimé le {new Date(repair.estimated_completion_at).toLocaleDateString("fr-FR", { dateStyle: "long" })}
            </div>
          )}
          {ready && <div className="text-sm text-success/90">Passez récupérer votre appareil aux horaires d'ouverture.</div>}
        </div>

        {/* Étapes visuelles */}
        <div className="bpei-surface p-5 sm:p-6">
          <RepairStages status={repair.status} />
        </div>

        {/* Message boutique */}
        {repair.customer_visible_notes && (
          <div className="rounded-xl border border-electric/30 bg-electric-soft p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-electric mb-1">Message de la boutique</div>
            <div className="text-sm">{repair.customer_visible_notes}</div>
          </div>
        )}

        {/* Historique détaillé */}
        <details className="bpei-surface p-5 sm:p-6 group" open>
          <summary className="font-display text-base font-bold cursor-pointer flex items-center gap-2 list-none">
            <Package className="h-4 w-4 text-electric" />
            Historique complet
            <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Afficher</span>
          </summary>
          <div className="mt-4">
            <RepairTimeline history={history} currentStatus={repair.status} />
          </div>
        </details>

        {/* Boutique + actions */}
        <div className="bpei-surface p-5 space-y-4">
          <div>
            <div className="font-semibold">{shop.name}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
              {shop.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{shop.city}</span>}
              {shop.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{shop.phone}</span>}
              {shop.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{shop.email}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {shop.phone && (
              <Button asChild size="sm" variant="outline">
                <a href={`tel:${shop.phone}`}><Phone className="h-4 w-4 mr-1.5" />Appeler</a>
              </Button>
            )}
            {mapsUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"><Navigation className="h-4 w-4 mr-1.5" />Itinéraire</a>
              </Button>
            )}
            {shop.email && (
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${shop.email}?subject=Dossier ${repair.repair_number}`}><Mail className="h-4 w-4 mr-1.5" />Écrire</a>
              </Button>
            )}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground pb-4">
          Dernière mise à jour : {new Date(repair.updated_at).toLocaleString("fr-FR")}
        </div>
      </div>
    </div>
  );
}

function Splash({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh grid place-items-center bg-surface-muted p-8 text-center">{children}</div>;
}