import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOnboardingState, saveOnboardingStep, completeOnboarding,
  skipOnboardingStep, saveShopIdentity,
} from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { MediaUploader } from "@/components/shop/MediaUploader";
import { CheckCircle2, Circle, ChevronRight, Save } from "lucide-react";

type StepKey =
  | "identity" | "contact" | "hours" | "media"
  | "payments" | "first_service" | "first_product"
  | "preview" | "publish";

const STEPS: { key: StepKey; label: string; required: boolean }[] = [
  { key: "identity", label: "Identité", required: true },
  { key: "contact", label: "Coordonnées", required: true },
  { key: "hours", label: "Horaires", required: true },
  { key: "media", label: "Logo & images", required: false },
  { key: "payments", label: "Paiements acceptés", required: false },
  { key: "first_service", label: "Premier service", required: false },
  { key: "first_product", label: "Premier produit", required: false },
  { key: "preview", label: "Prévisualisation", required: false },
  { key: "publish", label: "Publication", required: true },
];

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/onboarding")({
  head: () => ({ meta: [{ title: "Configuration de la boutique — BPEI" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const { shopId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const stateFn = useServerFn(getOnboardingState);
  const saveStepFn = useServerFn(saveOnboardingStep);
  const skipFn = useServerFn(skipOnboardingStep);
  const completeFn = useServerFn(completeOnboarding);

  const q = useQuery({
    queryKey: ["onboarding-state", shopId],
    queryFn: () => stateFn({ data: { shopId } }),
  });

  const [current, setCurrent] = useState<StepKey>("identity");

  if (q.isLoading) return <div className="p-8 text-sm text-muted-foreground">Chargement…</div>;
  if (q.error) return <div className="p-8 text-sm text-destructive">Erreur : {(q.error as Error).message}</div>;
  const state = q.data!;

  const done = (k: StepKey): boolean => {
    const d = (state.shop.onboarding_data as any) ?? {};
    if (d["_skipped_" + k]) return true;
    switch (k) {
      case "identity": return !!(state.shop.public_name || state.shop.name);
      case "contact": return !!(state.shop.phone && state.shop.email && state.shop.address);
      case "hours": return !!d.hours;
      case "media": return !!(state.shop.public_logo_url || state.shop.cover_image_url);
      case "payments": return !!d.payments;
      case "first_service": return state.servicesCount > 0;
      case "first_product": return state.stockCount > 0;
      case "preview": return !!d.preview;
      case "publish": return state.shop.onboarding_status === "completed";
    }
  };

  const completedCount = STEPS.filter(s => done(s.key)).length;
  const percent = Math.round((completedCount / STEPS.length) * 100);
  const requiredOk = STEPS.filter(s => s.required).every(s => done(s.key)) || done("first_service") || done("first_product");

  const goNext = () => {
    const idx = STEPS.findIndex(s => s.key === current);
    if (idx < STEPS.length - 1) setCurrent(STEPS[idx + 1].key);
  };

  const finish = async () => {
    try {
      await completeFn({ data: { shopId } });
      toast.success("Onboarding terminé — bienvenue !");
      qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] });
      router.navigate({ to: "/app/shop/$shopId/dashboard", params: { shopId } });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configuration de la boutique</h1>
          <p className="text-sm text-muted-foreground mt-1">
            En moins de 30 minutes, votre boutique est prête. Vous pouvez enregistrer et revenir plus tard.
          </p>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span>{completedCount} / {STEPS.length} étapes</span>
              <span>{percent}%</span>
            </div>
            <Progress value={percent} className="h-2" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <nav className="space-y-1 rounded-lg border bg-card p-2 h-fit">
            {STEPS.map(s => {
              const isDone = done(s.key);
              const active = s.key === current;
              return (
                <button key={s.key}
                  onClick={() => setCurrent(s.key)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition
                    ${active ? "bg-electric/10 text-electric font-medium" : "hover:bg-muted"}`}>
                  {isDone ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className="flex-1">{s.label}</span>
                  {!s.required && <Badge variant="outline" className="text-[10px]">Facultatif</Badge>}
                </button>
              );
            })}
          </nav>

          <div className="space-y-4">
            {current === "identity" && <IdentityStep shopId={shopId} shop={state.shop} onSaved={() => { qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] }); goNext(); }} />}
            {current === "contact" && <ContactStep shopId={shopId} shop={state.shop} onSaved={() => { qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] }); goNext(); }} />}
            {current === "hours" && <SimpleJsonStep shopId={shopId} stepKey="hours" title="Horaires d'ouverture" description="Éditeur détaillé disponible dans les paramètres Réservations. Cochez pour valider cette étape avec vos horaires actuels."
              saveFn={saveStepFn} onSaved={() => { qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] }); goNext(); }} />}
            {current === "media" && <MediaStep shopId={shopId} shop={state.shop} onNext={goNext} onSkip={async () => { await skipFn({ data: { shopId, step: "media" } }); qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] }); goNext(); }} />}
            {current === "payments" && <SimpleJsonStep shopId={shopId} stepKey="payments" title="Moyens de paiement acceptés" description="Réglable en détail dans Paramètres → Facturation. Cochez pour indiquer que vous avez configuré cette section."
              saveFn={saveStepFn} onSaved={() => { qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] }); goNext(); }} />}
            {current === "first_service" && <CTAStep title="Créer un premier service" description="Ajoutez au moins un service dans votre catalogue (diagnostic, remplacement d'écran, etc.)."
              link={{ to: "/app/shop/$shopId/catalog", params: { shopId } }} count={state.servicesCount} unit="service"
              onSkip={async () => { await skipFn({ data: { shopId, step: "first_service" } }); qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] }); goNext(); }}
              onNext={goNext} />}
            {current === "first_product" && <CTAStep title="Créer un premier produit" description="Ajoutez au moins une pièce ou un produit dans votre stock (facultatif si vous ne vendez que des services)."
              link={{ to: "/app/shop/$shopId/stock", params: { shopId } }} count={state.stockCount} unit="produit"
              onSkip={async () => { await skipFn({ data: { shopId, step: "first_product" } }); qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] }); goNext(); }}
              onNext={goNext} />}
            {current === "preview" && <SimpleJsonStep shopId={shopId} stepKey="preview" title="Prévisualisation" description="L'éditeur de page publique complet arrive prochainement. Vous pouvez déjà consulter votre fiche."
              saveFn={saveStepFn} onSaved={() => { qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] }); goNext(); }}
              extra={<Link to="/b/$shopId" params={{ shopId }} target="_blank" className="text-sm text-electric hover:underline">Voir la fiche publique →</Link>} />}
            {current === "publish" && (
              <Card>
                <CardHeader><CardTitle>Terminer la configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Cliquez pour finaliser votre configuration. Vous pourrez toujours modifier vos informations depuis les paramètres.
                    La <strong>publication de votre fiche publique</strong> sera validée par BPEI dans un prochain lot.
                  </p>
                  {!requiredOk && (
                    <div className="rounded-md border border-warning/50 bg-warning/10 p-3 text-xs">
                      Certaines étapes obligatoires ne sont pas encore complètes. Vous pouvez tout de même terminer et y revenir.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button onClick={finish} className="bg-electric text-electric-foreground hover:bg-electric/90">Terminer</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IdentityStep({ shopId, shop, onSaved }: { shopId: string; shop: any; onSaved: () => void }) {
  const save = useServerFn(saveShopIdentity);
  const [publicName, setPublicName] = useState<string>(shop.public_name ?? shop.name ?? "");
  const [description, setDescription] = useState<string>(shop.description ?? "");
  const m = useMutation({
    mutationFn: () => save({ data: { shopId, public_name: publicName || null, description: description || null } }),
    onSuccess: () => { toast.success("Identité enregistrée"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Identité de la boutique</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="pn">Nom public *</Label>
          <Input id="pn" value={publicName} onChange={e => setPublicName(e.target.value)} maxLength={120} />
          <p className="text-xs text-muted-foreground mt-1">C'est le nom qui apparaîtra publiquement.</p>
        </div>
        <div>
          <Label htmlFor="desc">Description courte</Label>
          <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={2000} />
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={() => m.mutate()} disabled={m.isPending || !publicName.trim()}>
            <Save className="mr-2 h-4 w-4" /> Enregistrer et continuer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ContactStep({ shopId, shop, onSaved }: { shopId: string; shop: any; onSaved: () => void }) {
  const save = useServerFn(saveShopIdentity);
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [email, setEmail] = useState(shop.email ?? "");
  const [address, setAddress] = useState(shop.address ?? "");
  const [city, setCity] = useState(shop.city ?? "");
  const [postal, setPostal] = useState(shop.postal_code ?? "");
  const m = useMutation({
    mutationFn: () => save({ data: { shopId, phone: phone || null, email: email || null, address: address || null, city: city || null, postal_code: postal || null } }),
    onSuccess: () => { toast.success("Coordonnées enregistrées"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Téléphone *</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><Label>Email public *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        </div>
        <div><Label>Adresse *</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <div><Label>Code postal</Label><Input value={postal} onChange={e => setPostal(e.target.value)} maxLength={20} /></div>
          <div><Label>Ville</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => m.mutate()} disabled={m.isPending || !phone.trim() || !email.trim() || !address.trim()}>
            <Save className="mr-2 h-4 w-4" /> Enregistrer et continuer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleJsonStep({ shopId, stepKey, title, description, saveFn, onSaved, extra }: {
  shopId: string; stepKey: string; title: string; description: string;
  saveFn: any; onSaved: () => void; extra?: React.ReactNode;
}) {
  const m = useMutation({
    mutationFn: () => saveFn({ data: { shopId, step: stepKey, data: { confirmed: true, at: new Date().toISOString() } } }),
    onSuccess: () => { toast.success("Étape validée"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        {extra}
        <div className="flex justify-end">
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            Valider cette étape <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MediaStep({ shopId, shop, onNext, onSkip }: { shopId: string; shop: any; onNext: () => void; onSkip: () => void }) {
  return (
    <Card>
      <CardHeader><CardTitle>Logo & image de couverture</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ces images seront affichées sur votre fiche publique et votre portail client. Étape facultative.
        </p>
        <MediaUploader shopId={shopId} kind="logo" currentPath={shop.public_logo_url} />
        <MediaUploader shopId={shopId} kind="cover" currentPath={shop.cover_image_url} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onSkip}>Passer</Button>
          <Button onClick={onNext}>Continuer <ChevronRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CTAStep({ title, description, link, count, unit, onNext, onSkip }: {
  title: string; description: string; link: any; count: number; unit: string; onNext: () => void; onSkip: () => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {count > 0 ? (
            <span className="text-success">✓ {count} {unit}{count > 1 ? "s" : ""} déjà créé{count > 1 ? "s" : ""}.</span>
          ) : (
            <span>Aucun {unit} pour l'instant.</span>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onSkip}>Passer</Button>
          <Link {...link}><Button variant="secondary">Ouvrir la section</Button></Link>
          <Button onClick={onNext}>Continuer <ChevronRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}