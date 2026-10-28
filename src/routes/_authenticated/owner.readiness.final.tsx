import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/owner/readiness/final")({
  head: () => ({ meta: [{ title: "Clôture — BPEI Bêta fermée v1.0" }, { name: "robots", content: "noindex" }] }),
  component: FinalReadinessPage,
});

const BLOCKERS = [
  "Création et validation des e-mails",
  "SPF / DKIM / DMARC",
  "Sauvegarde et restauration testées",
  "Test de charge",
  "Sélection de pilotes",
  "Bêta réelle exécutée",
  "37 variables à confirmer",
  "Validation avocat",
  "Validation RGPD",
  "Validation comptable et assurance",
  "Publication des documents validés",
  "Médiateur consommation lorsque nécessaire",
];

function FinalReadinessPage() {
  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Version figée</div>
        <div className="text-2xl font-semibold">BPEI — Bêta fermée v1.0</div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Statut produit</div>
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">PRÊT POUR BÊTA FERMÉE</Badge>
        </Card>
        <Card className="p-6 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Statut ouverture publique</div>
          <Badge variant="destructive">NON PRÊT</Badge>
        </Card>
      </div>

      <Card className="p-6 space-y-3">
        <div className="text-sm font-semibold">Blockers externes</div>
        <ol className="list-decimal pl-6 space-y-1 text-sm">
          {BLOCKERS.map((b) => <li key={b}>{b}</li>)}
        </ol>
      </Card>

      <Card className="p-6 text-sm text-muted-foreground">
        Rapport de clôture : <code>.lovable/bpei-cloture-definitive-rapport.md</code>
      </Card>
    </div>
  );
}