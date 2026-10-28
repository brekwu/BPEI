import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { supabase } from "@/integrations/supabase/client";
import { getBillingSettings, billingSettingsMissing } from "@/lib/billing-settings.functions";
import { PageContainer, PageHeader, SectionCard, StatusBadge, Skeleton } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle, HeartPulse, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/health")({
  head: () => ({ meta: [{ title: "Diagnostic — BPEI" }] }),
  component: HealthPage,
});

type Severity = "ok" | "warn" | "error";

interface Check {
  key: string;
  label: string;
  description: ReactNode;
  severity: Severity;
  hint?: ReactNode;
  action?: { to: string; label: string };
}

function HealthPage() {
  const { shopId } = useShop();
  const base = `/app/shop/${shopId}`;
  const settingsFn = useServerFn(getBillingSettings);

  const settings = useQuery({
    queryKey: ["billing-settings", shopId],
    queryFn: () => settingsFn({ data: { shopId } }),
  });

  const counts = useQuery({
    queryKey: ["health-counts", shopId],
    queryFn: async () => {
      const [customers, devices, repairs, services, technicians, invoicesOverdue] = await Promise.all([
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("shop_id", shopId).is("archived_at", null),
        supabase.from("devices").select("id", { count: "exact", head: true }).eq("shop_id", shopId).is("archived_at", null),
        supabase.from("repairs").select("id", { count: "exact", head: true }).eq("shop_id", shopId),
        supabase.from("service_catalog").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("active", true),
        supabase.from("shop_memberships").select("user_id", { count: "exact", head: true }).eq("shop_id", shopId),
        supabase.from("invoices").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("status", "overdue"),
      ]);
      return {
        customers: customers.count ?? 0,
        devices: devices.count ?? 0,
        repairs: repairs.count ?? 0,
        services: services.count ?? 0,
        technicians: technicians.count ?? 0,
        invoicesOverdue: invoicesOverdue.count ?? 0,
      };

    },
  });

  const loading = settings.isLoading || counts.isLoading;
  const missing = billingSettingsMissing(settings.data);
  const c = counts.data;

  const checks: Check[] = c
    ? [
        {
          key: "billing",
          label: "Paramètres de facturation",
          description: "Identité légale, adresse, numérotation des documents.",
          severity: missing.length === 0 ? "ok" : "error",
          hint: missing.length > 0 ? `Champs manquants : ${missing.join(", ")}` : "Configuration complète.",
          action: { to: `${base}/settings/billing`, label: "Ouvrir la facturation" },
        },
        {
          key: "team",
          label: "Équipe",
          description: "Au moins un membre doit être rattaché à la boutique.",
          severity: c.technicians >= 1 ? "ok" : "error",
          hint: `${c.technicians} membre${c.technicians > 1 ? "s" : ""}.`,
          action: { to: `${base}/team`, label: "Gérer l'équipe" },
        },
        {
          key: "services",
          label: "Prestations de rendez-vous",
          description: "Prestations actives proposées à la prise de RDV en ligne.",
          severity: c.services >= 1 ? "ok" : "warn",
          hint: c.services === 0
            ? "Aucune prestation active — la réservation en ligne ne proposera rien."
            : `${c.services} prestation${c.services > 1 ? "s" : ""} active${c.services > 1 ? "s" : ""}.`,
          action: { to: `${base}/settings/booking`, label: "Configurer les horaires" },
        },
        {
          key: "activity",
          label: "Activité",
          description: "Au moins un client et une réparation créés dans la boutique.",
          severity: c.customers >= 1 && c.repairs >= 1 ? "ok" : "warn",
          hint: `${c.customers} client${c.customers > 1 ? "s" : ""} · ${c.devices} appareil${c.devices > 1 ? "s" : ""} · ${c.repairs} dossier${c.repairs > 1 ? "s" : ""}.`,
          action: { to: `${base}/repairs`, label: "Voir les réparations" },
        },

        {
          key: "customers",
          label: "Base clients",
          description: "Fiches actives dans la boutique.",
          severity: c.customers >= 1 ? "ok" : "warn",
          hint: `${c.customers} client${c.customers > 1 ? "s" : ""} actif${c.customers > 1 ? "s" : ""}.`,
          action: { to: `${base}/clients`, label: "Voir les clients" },
        },
        {
          key: "overdue",
          label: "Factures en retard",
          description: "Factures dont l'échéance est dépassée sans règlement.",
          severity: c.invoicesOverdue === 0 ? "ok" : "warn",
          hint: c.invoicesOverdue === 0
            ? "Aucune facture en retard."
            : `${c.invoicesOverdue} facture${c.invoicesOverdue > 1 ? "s" : ""} à relancer.`,
          action: { to: `${base}/invoices`, label: "Voir les factures" },
        },
      ]
    : [];

  const errors = checks.filter((k) => k.severity === "error").length;
  const warnings = checks.filter((k) => k.severity === "warn").length;
  const oks = checks.filter((k) => k.severity === "ok").length;
  const overall: Severity = errors > 0 ? "error" : warnings > 0 ? "warn" : "ok";

  return (
    <PageContainer>
      <PageHeader
        title="Diagnostic de la boutique"
        description="Vérifie en un coup d'œil que votre configuration est complète et prête pour la production."
        actions={
          !loading && (
            <StatusBadge
              status={overall}
              label={overall === "ok" ? "Tout est bon" : overall === "warn" ? "Points d'attention" : "Action requise"}
              tone={overall === "ok" ? "success" : overall === "warn" ? "warning" : "destructive"}
            />
          )
        }
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile tone="success" label="OK" value={oks} icon={<CheckCircle2 className="h-5 w-5" />} />
            <SummaryTile tone="warning" label="À surveiller" value={warnings} icon={<AlertTriangle className="h-5 w-5" />} />
            <SummaryTile tone="destructive" label="Bloquant" value={errors} icon={<XCircle className="h-5 w-5" />} />
          </div>

          <SectionCard title="Vérifications" description="Chaque contrôle est ré-évalué à chaque ouverture de la page.">
            <ul className="divide-y divide-border">
              {checks.map((k) => (
                <li key={k.key} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <SeverityIcon severity={k.severity} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{k.label}</span>
                        <StatusBadge
                          status={k.severity}
                          size="sm"
                          label={k.severity === "ok" ? "OK" : k.severity === "warn" ? "Attention" : "Bloquant"}
                          tone={k.severity === "ok" ? "success" : k.severity === "warn" ? "warning" : "destructive"}
                        />
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{k.description}</p>
                      {k.hint && <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>}
                    </div>
                  </div>
                  {k.action && (
                    <Button asChild variant="ghost" size="sm" className="sm:self-center">
                      <Link to={k.action.to}>
                        {k.action.label}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="À propos de ce diagnostic"
            description="Ces contrôles couvrent la configuration métier. La sécurité (RLS, sauvegardes, chiffrement) est gérée par la plateforme."
          >
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <HeartPulse className="mt-0.5 h-5 w-5 text-electric" />
              <p>
                Une exécution automatique quotidienne et l'envoi d'alertes e-mail seront disponibles
                dans une prochaine version.
              </p>
            </div>
          </SectionCard>
        </>
      )}
    </PageContainer>
  );
}

function SeverityIcon({ severity }: { severity: Severity }) {
  if (severity === "ok") return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label="OK" />;
  if (severity === "warn") return <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-label="Attention" />;
  return <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-label="Bloquant" />;
}

function SummaryTile({
  tone, label, value, icon,
}: { tone: "success" | "warning" | "destructive"; label: string; value: number; icon: ReactNode }) {
  const bg =
    tone === "success" ? "bg-success/10 text-success border-success/20"
    : tone === "warning" ? "bg-warning/15 text-warning-foreground border-warning/25"
    : "bg-destructive/10 text-destructive border-destructive/20";
  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
        {icon}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}