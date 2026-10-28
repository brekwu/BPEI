import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { getShopStripeStatus, startStripeOnboarding, refreshStripeStatus, createStripeLoginLink } from "@/lib/stripe-connect.functions";
import { PageContainer, PageHeader } from "@/components/ui-kit";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreditCard, ExternalLink, RefreshCw, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/payments/stripe")({
  head: () => ({ meta: [{ title: "Stripe Connect — BPEI" }] }),
  component: StripeOnboardingPage,
});

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; description: string }> = {
  not_started: { label: "Non démarré", variant: "outline", description: "Créez votre compte Stripe pour commencer à encaisser par carte." },
  pending: { label: "Onboarding en cours", variant: "secondary", description: "Complétez les informations demandées par Stripe pour activer votre compte." },
  restricted: { label: "Compléments requis", variant: "secondary", description: "Stripe demande des informations complémentaires pour maintenir les encaissements." },
  active: { label: "Actif", variant: "default", description: "Votre compte encaisse les paiements par carte." },
  rejected: { label: "Refusé", variant: "destructive", description: "Stripe a refusé l'activation de votre compte. Contactez le support BPEI." },
  disabled: { label: "Désactivé", variant: "destructive", description: "Votre compte est désactivé côté Stripe. Contactez le support." },
};

function StripeOnboardingPage() {
  const ctx = useShop();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"onboard" | "refresh" | "login" | null>(null);

  const statusFn = useServerFn(getShopStripeStatus);
  const startFn = useServerFn(startStripeOnboarding);
  const refreshFn = useServerFn(refreshStripeStatus);
  const loginFn = useServerFn(createStripeLoginLink);

  const q = useQuery({
    queryKey: ["stripe-status", ctx.shopId],
    queryFn: () => statusFn({ data: { shopId: ctx.shopId } }),
    refetchOnWindowFocus: false,
  });

  const status = q.data as {
    stripe_account_id: string | null;
    stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean;
    stripe_details_submitted: boolean;
    stripe_onboarding_status: keyof typeof STATUS_META;
    stripe_environment: "test" | "live";
    stripe_requirements: { currently_due?: string[]; eventually_due?: string[]; past_due?: string[]; disabled_reason?: string | null } | null;
    stripe_platform_fee_bps: number;
    stripe_synced_at: string | null;
  } | undefined;

  const meta = status ? (STATUS_META[status.stripe_onboarding_status] ?? STATUS_META.pending) : STATUS_META.not_started;

  async function launchOnboarding() {
    setBusy("onboard");
    try {
      const base = window.location.origin;
      const returnUrl = `${base}/app/shop/${ctx.shopId}/payments/stripe?return=1`;
      const refreshUrl = `${base}/app/shop/${ctx.shopId}/payments/stripe?refresh=1`;
      const r = await startFn({ data: { shopId: ctx.shopId, returnUrl, refreshUrl } });
      window.location.href = r.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur Stripe");
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("refresh");
    try {
      await refreshFn({ data: { shopId: ctx.shopId } });
      await qc.invalidateQueries({ queryKey: ["stripe-status", ctx.shopId] });
      toast.success("Statut synchronisé");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de synchronisation");
    } finally {
      setBusy(null);
    }
  }

  async function openDashboard() {
    setBusy("login");
    try {
      const r = await loginFn({ data: { shopId: ctx.shopId } });
      window.open(r.url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'accès au dashboard");
    } finally {
      setBusy(null);
    }
  }

  const currentlyDue = status?.stripe_requirements?.currently_due ?? [];
  const pastDue = status?.stripe_requirements?.past_due ?? [];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Finance"
        title="Stripe Connect"
        description="Activez les paiements par carte directement sur votre compte Stripe. Les fonds vont sur votre compte bancaire, BPEI ne les stocke jamais."
      />

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div>
      ) : !status ? (
        <div className="text-sm text-muted-foreground">Boutique introuvable.</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Compte Stripe
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <Badge variant="outline">{status.stripe_environment === "live" ? "Production" : "Test"}</Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">{meta.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {status.stripe_account_id ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <InfoRow label="Identifiant Stripe" value={<code className="text-xs">{status.stripe_account_id}</code>} />
                  <InfoRow label="Encaissements carte" value={<StatusPill ok={status.stripe_charges_enabled} okLabel="Activés" koLabel="Non activés" />} />
                  <InfoRow label="Virements sortants" value={<StatusPill ok={status.stripe_payouts_enabled} okLabel="Activés" koLabel="Non activés" />} />
                  <InfoRow label="Formulaire soumis" value={<StatusPill ok={status.stripe_details_submitted} okLabel="Oui" koLabel="Non" />} />
                  <InfoRow label="Commission plateforme" value={<span>{(status.stripe_platform_fee_bps / 100).toFixed(2)} %</span>} />
                  <InfoRow label="Dernière synchro" value={status.stripe_synced_at ? new Date(status.stripe_synced_at).toLocaleString("fr-FR") : "Jamais"} />
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Aucun compte Stripe rattaché à cette boutique.</div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {status.stripe_onboarding_status === "active" ? (
                  <>
                    <Button variant="outline" onClick={openDashboard} disabled={busy === "login"}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {busy === "login" ? "Ouverture…" : "Ouvrir mon dashboard Stripe"}
                    </Button>
                    <Button variant="outline" onClick={refresh} disabled={busy === "refresh"}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} />
                      Synchroniser
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={launchOnboarding} disabled={busy === "onboard"}>
                      <CreditCard className="mr-2 h-4 w-4" />
                      {busy === "onboard" ? "Redirection…" : status.stripe_account_id ? "Continuer l'onboarding" : "Créer mon compte Stripe"}
                    </Button>
                    {status.stripe_account_id && (
                      <Button variant="outline" onClick={refresh} disabled={busy === "refresh"}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} />
                        Vérifier le statut
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {(currentlyDue.length > 0 || pastDue.length > 0) && (
            <Alert variant={pastDue.length > 0 ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Informations demandées par Stripe</AlertTitle>
              <AlertDescription>
                {pastDue.length > 0 && (
                  <div className="mt-1">
                    <div className="font-medium">En retard :</div>
                    <ul className="ml-4 list-disc text-xs">
                      {pastDue.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                )}
                {currentlyDue.length > 0 && (
                  <div className="mt-1">
                    <div className="font-medium">À fournir :</div>
                    <ul className="ml-4 list-disc text-xs">
                      {currentlyDue.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                  </div>
                )}
                <Button size="sm" variant="outline" className="mt-2" onClick={launchOnboarding} disabled={busy === "onboard"}>
                  Compléter mon dossier
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Comment ça marche</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Vous êtes redirigé sur Stripe pour remplir votre dossier (identité, RIB, activité).</p>
              <p>2. Stripe vérifie votre compte (quelques minutes à quelques jours selon les cas).</p>
              <p>3. Une fois activé, vous encaissez par carte via BPEI ; les fonds arrivent sur votre RIB selon votre calendrier de virements Stripe.</p>
              <p>4. BPEI ne stocke jamais vos identifiants bancaires. Vous pouvez à tout moment ouvrir votre dashboard Stripe pour gérer vos virements et documents.</p>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function StatusPill({ ok, okLabel, koLabel }: { ok: boolean; okLabel: string; koLabel: string }) {
  return <Badge variant={ok ? "default" : "outline"}>{ok ? okLabel : koLabel}</Badge>;
}