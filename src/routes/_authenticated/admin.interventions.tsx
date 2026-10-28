import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/interventions")({
  head: () => ({ meta: [{ title: "Demandes d'intervention — BPEI" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_platform_roles").select("role").eq("user_id", data.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin_bpei" || r.role === "owner_bpei")) throw redirect({ to: "/app" });
  },
  component: InterventionsAdmin,
});

type RecordItem = {
  id: string; reference: string; created_at: string; status: string; first_name: string;
  last_name: string; email: string; phone: string; requester_type: string; company_name: string | null;
  city: string; postal_code: string; device_type: string | null; problem_category: string | null;
  description: string; preferred_mode: string | null; urgency: string | null; availability: string | null;
  acquisition_source: string | null; referral_code: string | null; internal_note: string | null;
};
const STATUSES = [
  ["nouvelle", "Nouvelle"], ["en_cours", "En cours"], ["en_attente", "En attente"],
  ["orientee", "Orientée"], ["sans_suite", "Sans suite"], ["cloturee", "Clôturée"], ["archivee", "Archivée"],
] as const;
type ValidStatus = (typeof STATUSES)[number][0];

function InterventionsAdmin() {
  const [rows, setRows] = useState<RecordItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<ValidStatus>("nouvelle");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("intervention_requests").select("*")
      .order("created_at", { ascending: false }).limit(300);
    setLoading(false);
    if (error) { toast.error("Erreur de chargement : " + error.message); return; }
    setRows((data ?? []) as RecordItem[]);
  }
  useEffect(() => { void load(); }, []);

  const current = rows.find((r) => r.id === selected) ?? null;
  const filtered = useMemo(() => rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    return [r.reference, r.first_name, r.last_name, r.email, r.city, r.postal_code]
      .join(" ").toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"));
  }), [rows, query, filter]);

  function selectRow(r: RecordItem) {
    setSelected(r.id);
    setStatus(STATUSES.some(([s]) => s === r.status) ? r.status as ValidStatus : "nouvelle");
    setNote(r.internal_note ?? "");
  }
  async function save() {
    if (!current || saving) return;
    setSaving(true);
    const { error } = await supabase.from("intervention_requests")
      .update({ status, internal_note: note.trim() || null }).eq("id", current.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Dossier mis à jour");
    await load();
  }

  return (
    <AppShell title="Demandes d'intervention" subtitle="Registre des demandes clients, sans attribution automatique">
      <div className="mb-5 flex flex-wrap gap-3">
        <Button variant="outline" asChild><Link to="/admin">Administration</Link></Button>
        <Button variant="outline" asChild><Link to="/admin/techniciens">Candidatures techniciens</Link></Button>
        <span className="ml-auto self-center text-sm text-muted-foreground">{rows.length} demandes chargées</span>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Input aria-label="Recherche" placeholder="Référence, ville, e-mail…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="Statut" className="h-10 rounded-md border bg-background px-3" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tous les statuts</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_370px]">
        <Card><CardContent className="space-y-2 pt-6">
          {loading ? <p>Chargement…</p> : filtered.length === 0 ? <p>Aucune demande.</p> :
            filtered.map((r) => (
              <button type="button" key={r.id} onClick={() => selectRow(r)}
                className={selected === r.id ? "w-full rounded-lg border-2 border-primary p-4 text-left" : "w-full rounded-lg border p-4 text-left hover:border-primary"}>
                <div className="flex justify-between gap-3 text-xs">
                  <span className="font-mono">{r.reference}</span><span>{STATUSES.find(([s]) => s === r.status)?.[1] ?? r.status}</span>
                </div>
                <p className="mt-2 font-semibold">{r.first_name} {r.last_name} — {r.city} ({r.postal_code})</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</p>
              </button>
            ))}
        </CardContent></Card>
        <Card><CardContent className="space-y-4 pt-6">
          {current ? <>
            <h2 className="text-xl font-bold">{current.reference}</h2>
            <div className="space-y-2 text-sm">
              <p><strong>Client :</strong> {current.first_name} {current.last_name} ({current.requester_type})</p>
              {current.company_name && <p><strong>Entreprise :</strong> {current.company_name}</p>}
              <p><strong>Localisation :</strong> {current.postal_code} {current.city}</p>
              <p><strong>E-mail :</strong> <a href={"mailto:" + current.email} className="underline">{current.email}</a></p>
              <p><strong>Téléphone :</strong> <a href={"tel:" + current.phone} className="underline">{current.phone}</a></p>
              <p><strong>Appareil :</strong> {current.device_type ?? "Non précisé"}</p>
              <p><strong>Type :</strong> {current.problem_category ?? "Non précisé"}</p>
              <p><strong>Mode / délai :</strong> {current.preferred_mode ?? "—"} / {current.urgency ?? "—"}</p>
              <p><strong>Disponibilités :</strong> {current.availability ?? "—"}</p>
              <p className="whitespace-pre-wrap rounded-md bg-secondary/40 p-3">{current.description}</p>
              <p><strong>Acquisition :</strong> {current.acquisition_source ?? "—"} · <strong>Parrain :</strong> {current.referral_code ?? "—"}</p>
            </div>
            <label className="block text-sm font-medium">Statut
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={status} onChange={(e) => setStatus(e.target.value as ValidStatus)}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Note interne
              <Textarea className="mt-1" rows={4} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <Button disabled={saving} onClick={() => void save()} className="w-full">{saving ? "Enregistrement…" : "Enregistrer"}</Button>
            <p className="text-xs text-muted-foreground">Ce statut n'attribue aucune mission et n'encaisse aucun paiement.</p>
          </> : <p className="text-sm text-muted-foreground">Choisissez une demande pour voir ses détails.</p>}
        </CardContent></Card>
      </div>
    </AppShell>
  );
}
