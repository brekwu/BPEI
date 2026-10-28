import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/owner/beta")({
  head: () => ({ meta: [{ title: "Bêta fermée · Console patron" }] }),
  component: BetaPage,
});

type Row = { id: string; label: string; status: string; when: string | null; href?: string };

function BetaPage() {
  const [applications, setApplications] = useState<Row[]>([]);
  const [shops, setShops] = useState<Row[]>([]);
  const [bugs, setBugs] = useState<{ critical: number; high: number; total: number }>({ critical: 0, high: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: apps }, { data: sh }, { data: bg }] = await Promise.all([
        supabase.from("shop_applications").select("id,reference,status,contact_first_name,contact_last_name,created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("shops").select("id,name,status,created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("bug_reports").select("id,severity,status").in("status", ["new", "in_progress"]),
      ]);
      if (cancelled) return;
      setApplications((apps ?? []).map((a: any) => ({
        id: a.id,
        label: `${a.reference} — ${a.contact_first_name ?? ""} ${a.contact_last_name ?? ""}`.trim(),
        status: a.status,
        when: a.created_at,
      })));
      setShops((sh ?? []).map((s: any) => ({ id: s.id, label: s.name, status: s.status ?? "—", when: s.created_at })));
      const b = bg ?? [];
      setBugs({
        critical: b.filter((x: any) => x.severity === "critical").length,
        high: b.filter((x: any) => x.severity === "high").length,
        total: b.length,
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Vue pilotes</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Vue lecture seule agrégée depuis les tables existantes. Aucun pilote « virtuel » n'est affiché.
          La sélection et l'invitation restent des décisions manuelles owner — voir les canaux
          <Link to="/owner/candidatures" className="underline mx-1">Candidatures</Link>
          et
          <Link to="/owner/boutiques" className="underline mx-1">Structures</Link>.
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Bugs ouverts</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>Critiques : <Badge variant={bugs.critical ? "destructive" : "secondary"}>{bugs.critical}</Badge></div>
            <div>Hautes : <Badge variant={bugs.high ? "destructive" : "secondary"}>{bugs.high}</Badge></div>
            <div>Total : <Badge variant="outline">{bugs.total}</Badge></div>
            <Link to="/admin/bug-reports" className="text-xs underline">Registre complet →</Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Candidatures récentes</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {loading ? "…" : applications.length === 0 ? "Aucune" : (
              <ul className="space-y-1 max-h-64 overflow-auto">
                {applications.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex justify-between gap-2">
                    <span className="truncate">{a.label}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Structures actives</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {loading ? "…" : shops.length === 0 ? "Aucune" : (
              <ul className="space-y-1 max-h-64 overflow-auto">
                {shops.slice(0, 10).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className="truncate">{s.label}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Checklist parcours par pilote</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-muted-foreground">Cocher manuellement lors du suivi téléphonique/mail — le rendu ci-dessous est statique.</p>
          <ul className="grid gap-1 md:grid-cols-2">
            {[
              "Candidature créée / sauvegardée / soumise / complétée / approuvée",
              "Onboarding : invitation, connexion, structure, paramètres, équipe",
              "Client → appareil → réparation créés",
              "Rendez-vous planifié",
              "Devis → facture → PDF téléchargé",
              "Stock initial + fournisseur",
              "Notifications reçues",
              "Portail client (lien envoyé + accès testé)",
              "Ticket support / réclamation / signalement traité",
              "Export RGPD / suppression testés",
            ].map((s) => (
              <li key={s} className="flex gap-2"><input type="checkbox" disabled className="mt-1" /><span>{s}</span></li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Rapports</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><code>.lovable/beta-pilotes-rapport.md</code></div>
          <div><code>.lovable/ouverture-publique-go-no-go-rapport.md</code></div>
        </CardContent>
      </Card>
    </div>
  );
}