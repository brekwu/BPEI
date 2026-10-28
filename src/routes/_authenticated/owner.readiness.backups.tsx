import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/owner/readiness/backups")({
  head: () => ({ meta: [{ title: "Readiness sauvegardes · Console patron" }] }),
  component: BackupsReadiness,
});

function Row({ label, status, detail }: { label: string; status: "ok" | "human" | "not_run" | "warn"; detail?: string }) {
  const map = {
    ok: { label: "OK", cls: "bg-emerald-100 text-emerald-800" },
    human: { label: "HUMAN ACTION REQUIRED", cls: "bg-amber-100 text-amber-900" },
    not_run: { label: "NOT RUN", cls: "bg-slate-200 text-slate-800" },
    warn: { label: "À vérifier", cls: "bg-orange-100 text-orange-900" },
  }[status];
  return (
    <div className="flex items-start justify-between gap-3 border-b py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
      <Badge className={map.cls + " shrink-0"}>{map.label}</Badge>
    </div>
  );
}

function BackupsReadiness() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Sauvegarde base de données</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Row label="Fournisseur" status="ok" detail="Supabase managé via Lovable Cloud" />
          <Row label="Fréquence exacte" status="human" detail="Dépend du plan — à confirmer côté Cloud" />
          <Row label="Rétention" status="human" detail="Dépend du plan — à confirmer côté Cloud" />
          <Row label="Restauration Point-in-Time" status="human" detail="Non exposée dans l'outillage sandbox" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Storage (buckets)</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Row label="Persistance médias / logos / preuves" status="ok" detail="Gérée côté fournisseur" />
          <Row label="Sauvegarde applicative séparée" status="warn" detail="Aucune en place — dépend du plan Cloud" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Test de restauration</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Row label="Restauration bout-en-bout dans env isolé" status="not_run" detail="Aucun env isolé provisionnable depuis le sandbox" />
          <Row label="Export CSV owner" status="ok" detail="Cloud → Advanced settings → Export data" />
          <Row label="Filet de sécurité — export hebdomadaire owner" status="human" detail="À exécuter chaque semaine jusqu'à ouverture publique" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Procédure d'urgence</CardTitle></CardHeader>
        <CardContent className="text-sm">
          Documentée dans <code>.lovable/backup-restore-test-rapport.md</code> §4 (panne, suppression accidentelle, corruption, mauvais rollback, incident sécurité).
        </CardContent>
      </Card>
    </div>
  );
}