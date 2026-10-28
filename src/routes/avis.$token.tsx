import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { publicSubmitReview, publicGetReviewContext } from "@/lib/appointments.public.functions";
import { TurnstileWidget } from "@/components/security/TurnstileWidget";
import { BPEILogo } from "@/components/BPEILogo";
import { ShopBrand } from "@/components/shop/ShopBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star, Check, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/avis/$token")({
  head: () => ({
    meta: [
      { title: "Laisser un avis — BPEI" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicReview,
});

function StarInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}>
            <Star className={`h-5 w-5 transition-colors ${(hover || value) >= n ? "fill-warning text-warning" : "text-border"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PublicReview() {
  const { token } = Route.useParams();
  const submitFn = useServerFn(publicSubmitReview);
  const ctxFn = useServerFn(publicGetReviewContext);
  const ctxQ = useQuery({
    queryKey: ["review-ctx", token],
    queryFn: () => ctxFn({ data: { token } }),
    staleTime: 60_000,
  });
  const shop = ctxQ.data?.shop ?? null;

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [quality, setQuality] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () => submitFn({ data: {
      token, name, rating,
      title: title || null, comment: comment || null,
      ratingQuality: quality || null, ratingSpeed: speed || null, ratingCommunication: communication || null,
      turnstileToken, fingerprint: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : null,
    } }),
    onSuccess: () => { setDone(true); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (done) return (
    <Wrapper shopId={shop?.id ?? null} shopName={shop?.name ?? null}>
      <div className="text-center space-y-3">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success"><Check className="h-7 w-7" /></div>
        <h1 className="font-display text-xl font-bold">Merci pour votre avis !</h1>
        <p className="text-sm text-muted-foreground">Il sera publié après validation par la boutique.</p>
        <Link to="/" className="inline-block text-sm text-electric hover:underline">Retour à BPEI</Link>
      </div>
    </Wrapper>
  );

  return (
    <Wrapper shopId={shop?.id ?? null} shopName={shop?.name ?? null}>
      <div className="text-center mb-6">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-electric/10 text-electric mb-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Votre expérience</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Avis vérifié — {shop?.name ? `${shop.name}${shop.city ? ` · ${shop.city}` : ""}` : "lié à votre réparation"}.
        </p>
      </div>

      <div className="space-y-5">
        <div className="text-center bg-surface-muted rounded-xl p-4">
          <Label className="text-xs uppercase tracking-wider">Note globale *</Label>
          <div className="flex gap-1 mt-2 justify-center" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onMouseEnter={() => setHover(n)} onClick={() => setRating(n)}>
                <Star className={`h-10 w-10 transition-transform hover:scale-110 ${(hover || rating) >= n ? "fill-warning text-warning" : "text-border"}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border border-border rounded-xl p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Détails (optionnel)</div>
          <StarInput value={quality} onChange={setQuality} label="Qualité de la réparation" />
          <StarInput value={speed} onChange={setSpeed} label="Rapidité" />
          <StarInput value={communication} onChange={setCommunication} label="Communication" />
        </div>

        <div><Label>Votre nom *</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
        <div><Label>Titre</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex : Service impeccable" /></div>
        <div><Label>Commentaire</Label><Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} placeholder="Partagez votre expérience…" /></div>
        <TurnstileWidget onVerify={setTurnstileToken} action="submit_review" />
        <Button className="w-full bg-electric text-electric-foreground hover:bg-electric/90" disabled={mut.isPending || !name || rating === 0 || !turnstileToken} onClick={() => mut.mutate()}>
          {mut.isPending ? "Envoi…" : "Publier mon avis"}
        </Button>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children, shopId, shopName }: { children: React.ReactNode; shopId?: string | null; shopName?: string | null }) {
  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {shopId ? <ShopBrand shopId={shopId} shopName={shopName} size={40} variant="dark" /> : <BPEILogo variant="dark" />}
        </div>
      </header>
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="bpei-surface-elevated p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}