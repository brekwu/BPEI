import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, Globe2, Scale, ShieldCheck, Handshake, Clock, AlertTriangle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/")({
  head: () => ({ meta: [{ title: "À traiter · Console patron" }] }),
  component: ATraiter,
});

type Counts = {
  applications: number;
  publications: number;
  legal: number;
  verifications: number;
  agreementsPendingSig: number;
  agreementsOverdue: number;
  subsExpiring: number;
};

const EMPTY: Counts = { applications: 0, publications: 0, legal: 0, verifications: 0, agreementsPendingSig: 0, agreementsOverdue: 0, subsExpiring: 0 };

function ATraiter() {
  const [c, setC] = useState<Counts>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    const in30 = new Date(Date.now() + 30 * 86400_000).toISOString();
    const nowIso = new Date().toISOString();
    const head = { count: "exact" as const, head: true };

    const [app, pub, leg, ver, sigPend, overdue, subs] = await Promise.all([
      supabase.from("shop_applications").select("id", head).in("status", ["nouvelle", "verification", "info_manquante"]),
      supabase.from("shops").select("id", head).eq("public_profile_status", "pending_review"),
      supabase.from("shops").select("id", head).eq("legal_status", "submitted"),
      supabase.from("shops").select("id", head).eq("verification_status", "pending"),
      supabase.from("partner_agreements").select("id", head).in("status", ["proposed", "shop_signed", "independent_signed", "negotiation"]),
      supabase.from("partner_agreements").select("id", head).lte("end_date", nowIso).not("end_date", "is", null).not("status", "in", "(expired,terminated)"),
      supabase.from("shop_subscriptions").select("id", head).lte("ends_at", in30).in("status", ["trial", "active"]),
    ]);

    setC({
      applications: app.count ?? 0,
      publications: pub.count ?? 0,
      legal: leg.count ?? 0,
      verifications: ver.count ?? 0,
      agreementsPendingSig: sigPend.count ?? 0,
      agreementsOverdue: overdue.count ?? 0,
      subsExpiring: subs.count ?? 0,
    });
    setRefreshedAt(new Date());
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const total = c.applications + c.publications + c.legal + c.verifications + c.agreementsPendingSig + c.agreementsOverdue + c.subsExpiring;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">À traiter{loading ? " …" : ` (${total})`}</h2>
          <p className="text-xs text-muted-foreground">
            Toutes les actions patron en attente. {refreshedAt ? `Mis à jour à ${refreshedAt.toLocaleTimeString("fr-FR")}` : ""}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? "…" : "Rafraîchir"}</Button>
      </div>

      {!loading && total === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          🎉 Aucune action en attente. Bon travail.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Row icon={<Inbox className="h-5 w-5" />} count={c.applications} to="/app/../owner/candidatures"
            href="/owner/candidatures" label="Candidatures à examiner"
            hint="Nouvelles demandes, vérifications, informations manquantes"
            severity={c.applications > 0 ? "action" : "ok"} />
          <Row icon={<Globe2 className="h-5 w-5" />} count={c.publications} href="/owner/publications"
            label="Pages publiques à valider" hint="Demandes de publication en attente" severity={c.publications > 0 ? "action" : "ok"} />
          <Row icon={<Scale className="h-5 w-5" />} count={c.legal} href="/owner/juridique"
            label="Dossiers juridiques" hint="Soumis, en attente de validation" severity={c.legal > 0 ? "action" : "ok"} />
          <Row icon={<ShieldCheck className="h-5 w-5" />} count={c.verifications} href="/owner/verifications"
            label="Vérifications d'identité" hint="Dossiers documents à réviser" severity={c.verifications > 0 ? "action" : "ok"} />
          <Row icon={<Handshake className="h-5 w-5" />} count={c.agreementsPendingSig} href="/owner/partenariats"
            label="Accords en attente de signature" hint="Signatures manquantes côté boutique ou indépendant" severity={c.agreementsPendingSig > 0 ? "watch" : "ok"} />
          <Row icon={<AlertTriangle className="h-5 w-5" />} count={c.agreementsOverdue} href="/owner/partenariats"
            label="Accords à expirer" hint="Date de fin dépassée, statut à mettre à jour" severity={c.agreementsOverdue > 0 ? "warn" : "ok"} />
          <Row icon={<Clock className="h-5 w-5" />} count={c.subsExpiring} href="/owner/boutiques"
            label="Abonnements J-30" hint="Trial/actif expirant dans 30 jours" severity={c.subsExpiring > 0 ? "watch" : "ok"} />
        </div>
      )}
    </div>
  );
}

function Row({ icon, count, href, label, hint, severity }: { icon: React.ReactNode; count: number; href: string; label: string; hint: string; severity: "ok" | "watch" | "action" | "warn"; to?: string }) {
  const tone =
    severity === "warn" ? "border-red-300 bg-red-50" :
    severity === "action" ? "border-amber-300 bg-amber-50" :
    severity === "watch" ? "border-blue-200 bg-blue-50/60" :
    "border-border";
  const badgeTone =
    severity === "warn" ? "bg-red-600" :
    severity === "action" ? "bg-amber-600" :
    severity === "watch" ? "bg-blue-600" :
    "bg-emerald-600";
  return (
    <Link to={href as unknown as string} className="block group">
      <Card className={`transition-shadow group-hover:shadow-md ${tone}`}>
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div className="flex items-center gap-2 text-muted-foreground">{icon}<CardTitle className="text-sm">{label}</CardTitle></div>
          <Badge className={`${badgeTone} text-white`}>{count}</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{hint}</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-navy">
            Ouvrir <ArrowRight className="h-3 w-3" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}