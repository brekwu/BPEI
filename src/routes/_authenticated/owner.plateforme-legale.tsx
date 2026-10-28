import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { upsertPlatformLegalSettings } from "@/lib/legal.functions";
import {
  checkLegalDocumentPublishable,
  publishLegalDocument,
  createLegalDocumentRevision,
} from "@/lib/legal-publish.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/owner/plateforme-legale")({
  head: () => ({ meta: [{ title: "Centre juridique plateforme · BPEI" }] }),
  component: PlatformLegalPage,
});

const FIELDS: Array<[string, string, "text" | "textarea"]> = [
  ["legal_name", "Raison sociale", "text"],
  ["commercial_name", "Nom commercial", "text"],
  ["legal_form", "Forme juridique", "text"],
  ["capital_amount", "Capital social", "text"],
  ["registered_office_address", "Adresse", "text"],
  ["registered_office_postal_code", "Code postal", "text"],
  ["registered_office_city", "Ville", "text"],
  ["siren", "SIREN", "text"],
  ["siret", "SIRET", "text"],
  ["rcs_city", "RCS (ville)", "text"],
  ["vat_number", "N° TVA", "text"],
  ["professional_email", "Email professionnel", "text"],
  ["professional_phone", "Téléphone professionnel", "text"],
  ["publication_director_name", "Directeur de publication", "text"],
  ["hosting_provider_name", "Hébergeur (nom)", "text"],
  ["hosting_provider_address", "Hébergeur (adresse)", "textarea"],
  ["hosting_provider_website", "Hébergeur (site)", "text"],
  ["privacy_contact_email", "Contact vie privée", "text"],
  ["data_protection_officer_name", "DPO (nom)", "text"],
  ["data_protection_officer_email", "DPO (email)", "text"],
  ["mediator_name", "Médiateur (nom)", "text"],
  ["mediator_address", "Médiateur (adresse)", "textarea"],
  ["mediator_website", "Médiateur (site)", "text"],
];

function PlatformLegalPage() {
  const upsert = useServerFn(upsertPlatformLegalSettings);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [privacy, setPrivacy] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [openDoc, setOpenDoc] = useState<any | null>(null);

  async function loadDoc(id: string) {
    const { data } = await supabase.from("legal_documents").select("id, document_code, title, version, status, content, summary, requires_acceptance").eq("id", id).maybeSingle();
    if (data) setOpenDoc(data);
  }

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: r }, { data: p }, { data: d }] = await Promise.all([
        supabase.from("platform_legal_settings").select("*").limit(1).maybeSingle(),
        supabase.from("content_reports").select("id, report_number, category, status, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("privacy_requests").select("id, request_number, request_type, status, due_date, created_at").order("created_at", { ascending: false }).limit(50),
        supabase.from("legal_documents").select("id, document_code, title, version, status, updated_at").order("document_code"),
      ]);
      if (s) {
        const clean: Record<string, string> = {};
        for (const [k, v] of Object.entries(s)) if (typeof v === "string") clean[k] = v;
        setSettings(clean);
      }
      setReports(r ?? []); setPrivacy(p ?? []); setDocs(d ?? []);
    })();
  }, []);


  async function save() {
    setSaving(true);
    try {
      await upsert({ data: settings });
      toast.success("Enregistré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Identité légale de la plateforme</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map(([k, label, kind]) => (
            <label key={k} className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
              {kind === "textarea" ? (
                <Textarea value={settings[k] ?? ""} rows={2} onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))} />
              ) : (
                <Input value={settings[k] ?? ""} onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))} />
              )}
            </label>
          ))}
          <div className="sm:col-span-2 flex justify-end">
            <Button disabled={saving} onClick={save}>{saving ? "…" : "Enregistrer"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Documents juridiques & contrats ({docs.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded border border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-xs">
            Les documents en statut <code>draft</code> sont des <strong>modèles préparatoires</strong> à faire valider juridiquement.
            Aucune mention « conforme RGPD », « validé par un avocat » ou « certifié » ne doit être affichée publiquement tant qu'une validation extérieure n'a pas été obtenue.
          </div>
          <div className="rounded border border-border p-3 text-xs">
            <strong>Facturation électronique (2026-2027) :</strong> l'architecture ne garantit pas encore l'émission au format
            réglementé (Factur-X / UBL) ni le raccordement à une plateforme partenaire agréée. Ne pas activer d'émission
            électronique tant que le module correspondant n'est pas passé en <code>approved_for_production</code> dans le
            registre des modules sensibles.
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Code</th><th className="p-2">Titre</th><th className="p-2">Version</th><th className="p-2">Statut</th><th className="p-2">MàJ</th><th className="p-2"></th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="p-2 font-mono text-xs">{d.document_code}</td>
                  <td className="p-2">{d.title}</td>
                  <td className="p-2">v{d.version}</td>
                  <td className="p-2"><Badge variant={d.status === "published" ? "default" : "outline"}>{d.status}</Badge></td>
                  <td className="p-2 text-xs">{new Date(d.updated_at).toLocaleString("fr-FR")}</td>
                  <td className="p-2 text-right"><LegalDocActions doc={d} onOpen={() => loadDoc(d.id)} onChanged={() => window.location.reload()} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!openDoc} onOpenChange={(o) => !o && setOpenDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openDoc?.title} <span className="text-xs font-normal text-muted-foreground">v{openDoc?.version} — {openDoc?.status}</span></DialogTitle>
          </DialogHeader>
          {openDoc?.summary && <p className="text-xs text-muted-foreground">{openDoc.summary}</p>}
          <pre className="whitespace-pre-wrap text-xs font-sans leading-relaxed">{openDoc?.content}</pre>
        </DialogContent>
      </Dialog>


      <Card>
        <CardHeader><CardTitle>Signalements ({reports.length})</CardTitle></CardHeader>
        <CardContent>
          {reports.length === 0 ? <p className="text-sm text-muted-foreground">Aucun signalement.</p> : (
            <ul className="space-y-1 text-sm">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-t border-border py-2">
                  <span className="font-mono text-xs">{r.report_number}</span>
                  <span>{r.category}</span>
                  <Badge variant="outline">{r.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Demandes RGPD ({privacy.length})</CardTitle></CardHeader>
        <CardContent>
          {privacy.length === 0 ? <p className="text-sm text-muted-foreground">Aucune demande.</p> : (
            <ul className="space-y-1 text-sm">
              {privacy.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-t border-border py-2">
                  <span className="font-mono text-xs">{r.request_number}</span>
                  <span>{r.request_type}</span>
                  <Badge variant="outline">{r.status}</Badge>
                  <span className="text-xs text-muted-foreground">avant le {new Date(r.due_date).toLocaleDateString("fr-FR")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LegalDocActions({ doc, onOpen, onChanged }: { doc: any; onOpen: () => void; onChanged: () => void }) {
  const check = useServerFn(checkLegalDocumentPublishable);
  const publish = useServerFn(publishLegalDocument);
  const revise = useServerFn(createLegalDocumentRevision);
  const [checking, setChecking] = useState(false);
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<string>("");

  async function runCheck() {
    setChecking(true);
    try {
      const res = await check({ data: { document_id: doc.id } });
      setBlockers(res.publishable ? [] : res.blockers ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Contrôle impossible");
    } finally {
      setChecking(false);
    }
  }

  async function runPublish() {
    if (!confirm(`Publier ${doc.document_code} v${doc.version} définitivement ?`)) return;
    setBusy(true);
    try {
      await publish({ data: { document_id: doc.id, effective_date: effectiveDate || undefined } });
      toast.success("Document publié");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publication refusée");
    } finally { setBusy(false); }
  }

  async function runRevise() {
    setBusy(true);
    try {
      const res = await revise({ data: { source_document_id: doc.id } });
      toast.success(`Nouvelle version brouillon créée (${res.new_document_id.slice(0, 8)}…)`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(false); }
  }

  const canPublish = doc.status !== "published" && blockers !== null && blockers.length === 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={onOpen}>Voir</Button>
        <Button size="sm" variant="outline" onClick={runCheck} disabled={checking}>Contrôler</Button>
        {doc.status === "published" ? (
          <Button size="sm" variant="secondary" onClick={runRevise} disabled={busy}>Nouvelle version</Button>
        ) : (
          <Button size="sm" onClick={runPublish} disabled={busy || !canPublish} title={!canPublish ? "Contrôler d'abord et lever les blocages" : "Publier"}>Publier</Button>
        )}
      </div>
      {doc.status !== "published" && (
        <input
          type="date"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          className="rounded border border-border bg-background px-1 py-0.5 text-xs"
          title="Date d'effet"
        />
      )}
      {blockers !== null && (
        blockers.length === 0
          ? <span className="text-xs text-emerald-600">Publiable</span>
          : <ul className="max-w-xs text-right text-xs text-destructive">{blockers.map((b, i) => <li key={i}>• {b}</li>)}</ul>
      )}
    </div>
  );
}