import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/owner/readiness/emails")({
  head: () => ({ meta: [{ title: "Readiness e-mails · Console patron" }] }),
  component: EmailsReadiness,
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

function EmailsReadiness() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>E-mails de production</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Row label="Prestataire" status="ok" detail="Lovable Managed Email API" />
          <Row label="Domaine d'envoi prévu" status="ok" detail="notify.bpei.fr (délégation NS Lovable)" />
          <Row label="From auth" status="ok" detail="no-reply@notify.bpei.fr" />
          <Row label="Reply-To" status="warn" detail="Non défini côté code — à décider" />
          <Row label="Return-Path" status="ok" detail="Géré automatiquement par Lovable" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>DNS — SPF / DKIM / DMARC</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Row label="NS notify.bpei.fr → ns*.lovable.cloud" status="human" detail="À vérifier dans OVH + Cloud → Emails" />
          <Row label="SPF (TXT notify.bpei.fr)" status="human" detail="Géré par Lovable dans la zone déléguée" />
          <Row label="DKIM (sélecteur Lovable)" status="human" detail="Valeur visible uniquement dans Cloud → Emails" />
          <Row label="DMARC _dmarc.bpei.fr" status="human" detail="À créer chez OVH — v=DMARC1; p=none; rua=mailto:..." />
          <Row label="Passage DMARC p=quarantine puis p=reject" status="human" detail="Après 2–4 semaines de rapports p=none propres" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tests d'envoi</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Row label="signup / magic-link / recovery / invite / email-change / reauthentication" status="not_run" detail="Templates React Email prêts, envoi live non exécuté" />
          <Row label="Notifications métier (candidature, owner, support, réclamation)" status="not_run" detail="Aucune boîte pilote autorisée dans ce lot" />
          <Row label="Rendu Gmail / Outlook / mobile / dark mode" status="not_run" detail="Aucun client réel accessible depuis l'environnement" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Action owner</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>1. Ouvrir Cloud → Emails et vérifier que <strong>notify.bpei.fr</strong> est en statut <em>active</em>.</p>
          <p>2. Chez OVH, créer l'enregistrement DMARC sur la zone racine <strong>bpei.fr</strong>.</p>
          <p>3. S'envoyer un e-mail auth réel (recovery) et vérifier la réception + SPF/DKIM PASS dans les en-têtes.</p>
          <p>4. Reporter le résultat dans <code>.lovable/email-production-readiness-rapport.md</code>.</p>
        </CardContent>
      </Card>
    </div>
  );
}