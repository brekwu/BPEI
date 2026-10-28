import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/owner/legal/variables")({
  head: () => ({ meta: [{ title: "Variables juridiques · Console patron" }] }),
  component: VariablesPage,
});

type V = { name: string; desc: string; value: string; status: "known" | "to_confirm" | "unknown"; validation: string; blocking: boolean };

const IDENTITY: V[] = [
  { name: "legal_name", desc: "Dénomination légale", value: "Hugo Pavio", status: "to_confirm", validation: "RNE", blocking: true },
  { name: "commercial_name", desc: "Nom commercial", value: "BPEI", status: "known", validation: "—", blocking: false },
  { name: "legal_form", desc: "Forme juridique", value: "Entreprise individuelle", status: "to_confirm", validation: "RNE", blocking: true },
  { name: "tax_regime", desc: "Régime fiscal", value: "Micro-entrepreneur", status: "to_confirm", validation: "Expert-comptable", blocking: true },
  { name: "siren", desc: "SIREN", value: "105 370 001", status: "to_confirm", validation: "RNE/INSEE", blocking: true },
  { name: "siret", desc: "SIRET", value: "105 370 001 00015", status: "to_confirm", validation: "RNE/INSEE", blocking: true },
  { name: "ape_code", desc: "Code APE", value: "—", status: "unknown", validation: "INSEE", blocking: true },
  { name: "rne_rcs", desc: "RNE / RCS", value: "—", status: "unknown", validation: "RNE", blocking: true },
  { name: "vat_number", desc: "N° TVA intracom.", value: "—", status: "unknown", validation: "Expert-comptable", blocking: true },
  { name: "legal_address", desc: "Adresse siège", value: "142 rue de Rivoli, Paris", status: "to_confirm", validation: "Justificatif", blocking: true },
  { name: "postal_code", desc: "Code postal", value: "—", status: "unknown", validation: "Justificatif", blocking: true },
  { name: "legal_representative", desc: "Représentant légal", value: "Hugo Pavio", status: "known", validation: "—", blocking: false },
  { name: "publication_director", desc: "Directeur de publication", value: "Hugo Pavio", status: "known", validation: "—", blocking: false },
];

const CONTACTS: V[] = [
  { name: "contact_email", desc: "E-mail contact", value: "—", status: "unknown", validation: "—", blocking: true },
  { name: "support_email", desc: "E-mail support", value: "—", status: "unknown", validation: "—", blocking: true },
  { name: "complaints_email", desc: "E-mail réclamations", value: "—", status: "unknown", validation: "—", blocking: true },
  { name: "privacy_email", desc: "E-mail RGPD", value: "—", status: "unknown", validation: "DPO", blocking: true },
  { name: "phone", desc: "Téléphone", value: "—", status: "unknown", validation: "—", blocking: false },
];

const HOSTING: V[] = [
  { name: "hosting_provider", desc: "Hébergeur", value: "Lovable", status: "to_confirm", validation: "Entité juridique", blocking: true },
  { name: "hosting_entity", desc: "Entité juridique hébergeur", value: "—", status: "unknown", validation: "—", blocking: true },
  { name: "subprocessor_list", desc: "Sous-traitants ultérieurs", value: "—", status: "unknown", validation: "DPO", blocking: true },
  { name: "email_provider", desc: "Prestataire e-mails", value: "Lovable Managed Email", status: "to_confirm", validation: "DPO", blocking: true },
  { name: "backup_retention", desc: "Rétention sauvegardes", value: "—", status: "unknown", validation: "—", blocking: true },
  { name: "rpo_rto", desc: "RPO / RTO", value: "—", status: "unknown", validation: "—", blocking: true },
  { name: "incident_notification_deadline", desc: "Délai notif. incident contractuel", value: "72h max RGPD", status: "to_confirm", validation: "Avocat", blocking: true },
];

const RETENTION: V[] = [
  { name: "retention_customers", desc: "Clients actifs", value: "3 ans après dernier contact", status: "to_confirm", validation: "CNIL", blocking: true },
  { name: "retention_invoices", desc: "Factures", value: "10 ans", status: "to_confirm", validation: "Expert-comptable", blocking: true },
  { name: "retention_repairs", desc: "Réparations", value: "3 ans", status: "to_confirm", validation: "CNIL", blocking: true },
  { name: "retention_messages", desc: "Messages", value: "1 an", status: "to_confirm", validation: "CNIL", blocking: true },
  { name: "retention_media", desc: "Médias", value: "Dossier + 1 an", status: "to_confirm", validation: "CNIL", blocking: true },
  { name: "retention_logs", desc: "Logs d'accès", value: "12 mois", status: "to_confirm", validation: "CNIL", blocking: true },
  { name: "dpo_required", desc: "DPO obligatoire ?", value: "—", status: "unknown", validation: "RGPD", blocking: true },
];

const INSURANCE: V[] = [
  { name: "rc_pro_policy", desc: "RC pro", value: "—", status: "unknown", validation: "Assureur", blocking: true },
  { name: "cyber_policy", desc: "Cyber", value: "—", status: "unknown", validation: "Assureur", blocking: true },
  { name: "data_breach_policy", desc: "Atteinte aux données", value: "—", status: "unknown", validation: "Assureur", blocking: true },
  { name: "insurance_amount", desc: "Plafonds", value: "—", status: "unknown", validation: "Assureur", blocking: true },
];

const MEDIATION: V[] = [
  { name: "mediator_name", desc: "Médiateur consommation", value: "—", status: "unknown", validation: "Adhésion", blocking: true },
  { name: "mediator_url", desc: "URL médiateur", value: "—", status: "unknown", validation: "—", blocking: true },
  { name: "competent_court", desc: "Juridiction compétente", value: "Paris", status: "to_confirm", validation: "Avocat", blocking: true },
  { name: "applicable_law", desc: "Droit applicable", value: "France", status: "to_confirm", validation: "Avocat", blocking: true },
];

const COMMERCIAL: V[] = [
  { name: "subscription_duration", desc: "Durée engagement", value: "—", status: "unknown", validation: "Décision owner", blocking: true },
  { name: "cancellation_notice", desc: "Préavis résiliation", value: "—", status: "unknown", validation: "Décision owner", blocking: true },
  { name: "subordination_prevention_clauses", desc: "Clauses anti-subordination", value: "—", status: "unknown", validation: "Avocat", blocking: true },
  { name: "mission_price_formula", desc: "Formule prix mission", value: "—", status: "unknown", validation: "Décision owner", blocking: true },
];

function StatusBadge({ s }: { s: V["status"] }) {
  const map = {
    known: { l: "Connu", c: "bg-emerald-100 text-emerald-800" },
    to_confirm: { l: "À confirmer", c: "bg-amber-100 text-amber-900" },
    unknown: { l: "Inconnu", c: "bg-red-100 text-red-800" },
  }[s];
  return <Badge className={map.c}>{map.l}</Badge>;
}

function Section({ title, rows }: { title: string; rows: V[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-xs">
          {rows.map((r) => (
            <div key={r.name} className="grid grid-cols-12 gap-2 border-b py-1.5 last:border-0 items-start">
              <div className="col-span-3 font-mono text-[11px]">{r.name}</div>
              <div className="col-span-4">{r.desc}</div>
              <div className="col-span-3 truncate">{r.value}</div>
              <div className="col-span-2 flex items-center gap-1 justify-end">
                <StatusBadge s={r.status} />
                {r.blocking && <Badge variant="destructive" className="text-[9px]">bloq.</Badge>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VariablesPage() {
  const all = [...IDENTITY, ...CONTACTS, ...HOSTING, ...RETENTION, ...INSURANCE, ...MEDIATION, ...COMMERCIAL];
  const blocking = all.filter((v) => v.blocking && v.status !== "known").length;
  const known = all.filter((v) => v.status === "known").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Variables juridiques — assistant de collecte</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Source de vérité : <code>.lovable/registre-variables.md</code>. Ce panneau est en lecture seule — la mise à jour se fait en modifiant le registre.</p>
          <div className="flex gap-4">
            <div>Bloquantes non résolues : <Badge variant="destructive">{blocking}</Badge></div>
            <div>Prêtes : <Badge className="bg-emerald-100 text-emerald-800">{known}</Badge></div>
            <div>Total : <Badge variant="outline">{all.length}</Badge></div>
          </div>
        </CardContent>
      </Card>
      <Section title="Identité légale" rows={IDENTITY} />
      <Section title="Contacts" rows={CONTACTS} />
      <Section title="Hébergement / sous-traitants / sécurité" rows={HOSTING} />
      <Section title="Conservation / RGPD" rows={RETENTION} />
      <Section title="Assurances" rows={INSURANCE} />
      <Section title="Médiation / juridiction" rows={MEDIATION} />
      <Section title="Commercial / contrats" rows={COMMERCIAL} />
    </div>
  );
}