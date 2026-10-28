import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  publicGetShopBooking, publicGetAvailableSlots, publicBookAppointment,
} from "@/lib/appointments.public.functions";
import { ShopReviewsSummary } from "@/components/public/ShopReviewsSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BPEILogo } from "@/components/BPEILogo";
import { ShopBrand } from "@/components/shop/ShopBrand";
import { Check, MapPin, Phone, Mail, Calendar, Store, CalendarPlus, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { TurnstileWidget } from "@/components/security/TurnstileWidget";

export const Route = createFileRoute("/reserver/$shopId")({
  head: ({ params }) => ({
    meta: [
      { title: "Prendre rendez-vous — BPEI" },
      { name: "description", content: "Réservez un créneau dans votre boutique BPEI." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicBooking,
});

const DAY_LABEL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function PublicBooking() {
  const { shopId } = Route.useParams();
  const getShopFn = useServerFn(publicGetShopBooking);
  const getSlotsFn = useServerFn(publicGetAvailableSlots);
  const bookFn = useServerFn(publicBookAppointment);

  const shopQ = useQuery({
    queryKey: ["public-shop", shopId],
    queryFn: () => getShopFn({ data: { shopId } }),
  });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [serviceId, setServiceId] = useState<string>("");
  const [day, setDay] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [slot, setSlot] = useState<{ starts_at: string; ends_at: string } | null>(null);
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(""); const [device, setDevice] = useState("");
  const [problem, setProblem] = useState("");
  const [confirmed, setConfirmed] = useState<{ id: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // 7-day sliding window starting today
  const days7 = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today); d.setDate(today.getDate() + i); return d;
    });
  }, []);

  const slotsFrom = new Date(day);
  const slotsTo = new Date(day); slotsTo.setHours(23, 59, 59, 999);

  const slotsQ = useQuery({
    queryKey: ["public-slots", shopId, serviceId, slotsFrom.toISOString()],
    queryFn: () => getSlotsFn({ data: {
      shopId, serviceId,
      from: slotsFrom.toISOString(), to: slotsTo.toISOString(),
    } }),
    enabled: !!serviceId && step >= 2,
  });

  const bookMut = useMutation({
    mutationFn: () => bookFn({ data: {
      shopId, serviceId, startsAt: slot!.starts_at,
      name, phone, email: email || null,
      deviceDescription: device || null, problemDescription: problem || null,
      turnstileToken, fingerprint: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : null,
    } }),
    onSuccess: (res) => { setConfirmed({ id: res.id }); setStep(4); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (shopQ.isLoading) return <Splash>Chargement…</Splash>;
  if (!shopQ.data) return (
    <Splash>
      <p className="font-semibold">Boutique introuvable</p>
      <Link to="/" className="text-electric text-sm underline mt-2 inline-block">Retour à l'accueil</Link>
    </Splash>
  );

  const { shop, services, hours } = shopQ.data;
  const selectedService = services.find((s) => s.id === serviceId);

  if (confirmed) {
    const startsAt = slot!.starts_at;
    const endsAt = slot!.ends_at;
    const shopLocation = [shop.city, (shop as any).address ?? (shop as any).address_line1].filter(Boolean).join(", ");
    const ics = () => downloadIcs(
      `rdv-${confirmed.id.slice(0, 8)}.ics`,
      buildIcs({
        uid: confirmed.id,
        title: `RDV ${shop.name} — ${selectedService?.name ?? "Prestation"}`,
        description: `Réservation BPEI · Réf ${confirmed.id.slice(0, 8)}${problem ? `\nProblème : ${problem}` : ""}`,
        location: shopLocation || shop.name,
        startsAt, endsAt,
      })
    );
    return (
      <div className="min-h-dvh bg-surface-muted">
        <PublicHeader shopName={shop.name} shopId={shopId} />
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="bpei-surface-elevated p-8 text-center space-y-5">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
              <Check className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-bold">Rendez-vous demandé !</h1>
            <p className="text-sm text-muted-foreground">
              Référence : <span className="font-mono text-navy">{confirmed.id.slice(0, 8)}</span>
            </p>
            <div className="rounded-xl border-2 border-electric/30 bg-electric-soft/50 p-4 text-left space-y-2 text-sm">
              <div className="flex items-center gap-2 font-semibold text-electric">
                <Calendar className="h-4 w-4" />
                {new Date(startsAt).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-electric/20">
                <div><div className="text-muted-foreground">Boutique</div><div className="font-medium">{shop.name}</div></div>
                <div><div className="text-muted-foreground">Prestation</div><div className="font-medium">{selectedService?.name}</div></div>
                <div><div className="text-muted-foreground">Nom</div><div className="font-medium">{name}</div></div>
                <div><div className="text-muted-foreground">Téléphone</div><div className="font-medium">{phone}</div></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button onClick={ics} variant="outline" size="sm"><CalendarPlus className="h-4 w-4 mr-1.5" />Ajouter à mon agenda</Button>
              <Button asChild variant="outline" size="sm"><Link to="/portail">Voir mon espace</Link></Button>
            </div>
            <Link to="/" className="inline-block text-xs text-muted-foreground hover:text-electric">Retour à l'accueil BPEI</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface-muted">
      <PublicHeader shopName={shop.name} shopId={shopId} />

      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="bpei-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold">{shop.name}</h1>
              <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                {shop.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{shop.city}</span>}
                {shop.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{shop.phone}</span>}
                {shop.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{shop.email}</span>}
              </div>
            </div>
          </div>
        </div>

        <Stepper step={step} />

        {step === 1 && (
          <Card title="1. Choisissez une prestation">
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Cette boutique n'a pas encore de prestation en ligne. Contactez-la directement.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map((s) => (
                  <button key={s.id} onClick={() => { setServiceId(s.id); setStep(2); }}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${serviceId === s.id ? "border-electric bg-electric-soft" : "border-border hover:border-electric/50"}`}>
                    <div className="font-semibold">{s.name}</div>
                    {s.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</div>}
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{s.estimated_duration_minutes ?? 30} min</span>
                      {s.price_ttc_cents != null && <span className="font-semibold text-navy">{formatMoney(s.price_ttc_cents, s.currency)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {step >= 2 && (
          <Card title="2. Choisissez un créneau">
            <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-2 px-2 snap-x">
              {days7.map((d) => {
                const isSel = d.toDateString() === day.toDateString();
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => { setDay(d); setSlot(null); }}
                    className={`snap-start shrink-0 px-3 py-2 rounded-lg border-2 text-center min-w-[68px] transition-all ${isSel ? "border-electric bg-electric text-electric-foreground shadow-electric" : "border-border bg-surface hover:border-electric/40"}`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider">{DAY_LABEL[d.getDay()].slice(0, 3)}</div>
                    <div className="text-lg font-bold leading-tight">{d.getDate()}</div>
                    <div className="text-[10px] opacity-80">{d.toLocaleDateString("fr-FR", { month: "short" })}</div>
                  </button>
                );
              })}
            </div>
            {slotsQ.isLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Chargement des créneaux…</p>
            ) : (slotsQ.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Aucun créneau disponible ce jour. Essayez un autre jour.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {slotsQ.data!.map((s) => {
                  const active = slot?.starts_at === s.starts_at;
                  return (
                    <button key={s.starts_at} onClick={() => { setSlot(s); setStep(3); }}
                      className={`px-3 py-2 rounded-md text-sm font-medium border transition-all ${active ? "border-electric bg-electric text-electric-foreground" : "border-border hover:border-electric"}`}>
                      {new Date(s.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {step >= 3 && slot && (
          <Card title="3. Vos coordonnées">
            <div className="mb-4 rounded-lg border border-electric/30 bg-electric-soft p-3 text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-electric shrink-0" />
              <div>
                <div className="font-semibold">{selectedService?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(slot.starts_at).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Nom *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
                <div><Label>Téléphone *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} /></div>
              <div><Label>Votre appareil</Label><Input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="Ex : MacBook Pro 13'' 2020" maxLength={500} /></div>
              <div><Label>Décrivez le problème</Label><Textarea rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} maxLength={2000} /></div>
              <TurnstileWidget onVerify={setTurnstileToken} action="book_appointment" />
              <Button className="w-full bg-electric text-electric-foreground hover:bg-electric/90" onClick={() => bookMut.mutate()} disabled={bookMut.isPending || !name || !phone || !turnstileToken}>
                {bookMut.isPending ? "Envoi…" : "Confirmer la réservation"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                En réservant, vous acceptez d'être contacté par la boutique pour confirmer votre rendez-vous.
              </p>
            </div>
          </Card>
        )}

        <ShopReviewsSummary shopId={shopId} />
      </div>
    </div>
  );
}

function PublicHeader({ shopName, shopId }: { shopName: string; shopId?: string }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
        <ShopBrand shopId={shopId ?? null} shopName={null} size={40} variant="dark" />
        <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Store className="h-3.5 w-3.5" />{shopName}</div>
      </div>
    </header>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bpei-surface p-6">
      <h2 className="font-display text-lg font-bold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Prestation", "Créneau", "Coordonnées", "Confirmation"];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const done = step > i + 1;
        const current = step === i + 1;
        return (
          <div key={l} className="flex items-center gap-2 flex-1">
            <div className={`h-8 w-8 grid place-items-center rounded-full text-xs font-bold shrink-0 ${done ? "bg-success text-success-foreground" : current ? "bg-navy text-navy-foreground" : "bg-border text-muted-foreground"}`}>
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <div className={`text-xs font-medium hidden sm:block ${current ? "text-navy" : "text-muted-foreground"}`}>{l}</div>
            {i < labels.length - 1 && <div className={`flex-1 h-0.5 ${done ? "bg-success" : "bg-border"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function Splash({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh grid place-items-center bg-surface-muted p-8 text-center text-muted-foreground">{children}</div>;
}