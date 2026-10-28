import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert, ScrollText, Scale, FileWarning, ClipboardCheck, ShieldCheck, Handshake } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/legal")({
  head: () => ({ meta: [{ title: "Centre juridique — BPEI" }] }),
  component: LegalHub,
});

type Counts = {
  roles: number;
  decisions: number;
  processing: number;
  incidents: number;
  incidentsOpen: number;
  insurance: number;
  insuranceExpiring: number;
  modulesBlocked: number;
  modulesTotal: number;
  verificationsExpiring: number;
  exports: number;
  adminSessions7d: number;
};

function LegalHub() {
  const [tab, setTab] = useState("overview");
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const in90 = new Date(now.getTime() + 90 * 86400000).toISOString();
      const days7ago = new Date(now.getTime() - 7 * 86400000).toISOString();
      const [roles, decisions, processing, incidents, incidentsOpen, insurance, insuranceExpiring, modules, modulesBlocked, verifs, exports, adminSessions] = await Promise.all([
        supabase.from("legal_role_definitions").select("id", { count: "exact", head: true }),
        supabase.from("legal_decisions").select("id", { count: "exact", head: true }),
        supabase.from("processing_activity_roles").select("id", { count: "exact", head: true }),
        supabase.from("security_incidents").select("id", { count: "exact", head: true }),
        supabase.from("security_incidents").select("id", { count: "exact", head: true }).in("status", ["detected", "investigating", "contained", "remediating", "monitoring"]),
        supabase.from("platform_insurance_records").select("id", { count: "exact", head: true }),
        supabase.from("platform_insurance_records").select("id", { count: "exact", head: true }).lte("expiration_date", in90.slice(0, 10)),
        supabase.from("sensitive_module_approvals").select("id", { count: "exact", head: true }),
        supabase.from("sensitive_module_approvals").select("id", { count: "exact", head: true }).eq("current_status", "blocked"),
        supabase.from("professional_verification_checks").select("id", { count: "exact", head: true }).lte("expires_at", in90),
        supabase.from("data_export_requests").select("id", { count: "exact", head: true }),
        supabase.from("admin_access_sessions").select("id", { count: "exact", head: true }).gte("started_at", days7ago),
      ]);
      setCounts({
        roles: roles.count ?? 0,
        decisions: decisions.count ?? 0,
        processing: processing.count ?? 0,
        incidents: incidents.count ?? 0,
        incidentsOpen: incidentsOpen.count ?? 0,
        insurance: insurance.count ?? 0,
        insuranceExpiring: insuranceExpiring.count ?? 0,
        modulesTotal: modules.count ?? 0,
        modulesBlocked: modulesBlocked.count ?? 0,
        verificationsExpiring: verifs.count ?? 0,
        exports: exports.count ?? 0,
        adminSessions7d: adminSessions.count ?? 0,
      });
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Centre juridique</h1>
        <p className="text-muted-foreground text-sm">
          Socle contractuel, RGPD, réversibilité, sécurité et assurances. Les textes générés sont des <strong>modèles préparatoires</strong> à faire valider juridiquement — aucune mention de conformité ne doit être affichée sans validation extérieure réelle.
        </p>
      </div>

      {counts && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <KpiCard icon={Scale} label="Rôles définis" value={counts.roles} />
          <KpiCard icon={ClipboardCheck} label="Décisions" value={counts.decisions} />
          <KpiCard icon={ScrollText} label="Traitements RGPD" value={counts.processing} />
          <KpiCard icon={ShieldAlert} label="Incidents ouverts" value={counts.incidentsOpen} tone={counts.incidentsOpen > 0 ? "danger" : "muted"} />
          <KpiCard icon={ShieldCheck} label="Assurances" value={`${counts.insurance}`} sub={counts.insuranceExpiring > 0 ? `${counts.insuranceExpiring} expirent < 90j` : undefined} tone={counts.insuranceExpiring > 0 ? "warn" : "muted"} />
          <KpiCard icon={FileWarning} label="Modules bloqués" value={`${counts.modulesBlocked}/${counts.modulesTotal}`} tone={counts.modulesBlocked > 0 ? "warn" : "muted"} />
          <KpiCard icon={Handshake} label="Vérifs expirantes" value={counts.verificationsExpiring} tone={counts.verificationsExpiring > 0 ? "warn" : "muted"} />
          <KpiCard icon={AlertTriangle} label="Accès admin 7j" value={counts.adminSessions7d} />
        </div>
      )}

      <Card className="p-1">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">À traiter</TabsTrigger>
            <TabsTrigger value="modules">Modules sensibles</TabsTrigger>
            <TabsTrigger value="roles">Rôles</TabsTrigger>
            <TabsTrigger value="decisions">Décisions</TabsTrigger>
            <TabsTrigger value="processing">RGPD</TabsTrigger>
            <TabsTrigger value="retention">Conservation</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="insurance">Assurances</TabsTrigger>
            <TabsTrigger value="admin">Accès admin</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="p-4"><Overview /></TabsContent>
          <TabsContent value="modules" className="p-4"><SensitiveModulesPanel /></TabsContent>
          <TabsContent value="roles" className="p-4"><RolesPanel /></TabsContent>
          <TabsContent value="decisions" className="p-4"><DecisionsPanel /></TabsContent>
          <TabsContent value="processing" className="p-4"><ProcessingPanel /></TabsContent>
          <TabsContent value="retention" className="p-4"><RetentionPanel /></TabsContent>
          <TabsContent value="incidents" className="p-4"><IncidentsPanel /></TabsContent>
          <TabsContent value="insurance" className="p-4"><InsurancePanel /></TabsContent>
          <TabsContent value="admin" className="p-4"><AdminAccessPanel /></TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone = "muted" }: { icon: any; label: string; value: number | string; sub?: string; tone?: "muted" | "warn" | "danger" }) {
  const toneClass = tone === "danger" ? "border-destructive/40" : tone === "warn" ? "border-amber-500/40" : "";
  return (
    <Card className={`p-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-amber-600 mt-0.5">{sub}</div>}
    </Card>
  );
}

function Overview() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">Priorités juridiques structurantes à traiter avant toute activation payante ou publique :</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Faire relire le <strong>contrat SaaS BPEI</strong> et ses annexes par un conseil juridique.</li>
        <li>Faire valider le <strong>contrat-cadre boutique/indépendant</strong> et le modèle de bon de mission (risque de requalification).</li>
        <li>Renseigner les <strong>assurances</strong> réelles (RC pro SaaS, cyber, atteinte aux données) et retirer toute mention de garantie non couverte.</li>
        <li>Compléter la <strong>cartographie RGPD</strong> et lever tous les rôles <em>to_be_determined</em>.</li>
        <li>Rédiger la <strong>politique de conservation</strong> par catégorie et valider les durées légales (factures, journaux).</li>
        <li>Ne pas activer publiquement un module tant que son statut n'est pas <code>approved_for_beta</code> ou <code>approved_for_production</code>.</li>
      </ul>
      <p className="text-muted-foreground italic">Rappel : ne jamais afficher « conforme RGPD », « validé par un avocat » ou « certifié » sans preuve extérieure.</p>
    </div>
  );
}

// ------------------- Sensitive modules -------------------
type Module = {
  id: string; module_code: string; module_name: string; risk_level: string;
  current_status: string; blockers: string | null; notes: string | null;
  approved_at: string | null;
};
const MODULE_STATUSES = ["blocked", "architecture_only", "internal_test", "legal_review_pending", "accounting_review_pending", "technical_review_pending", "approved_for_beta", "approved_for_production", "suspended"];

function SensitiveModulesPanel() {
  const [rows, setRows] = useState<Module[]>([]);
  const load = async () => {
    const { data } = await supabase.from("sensitive_module_approvals").select("*").order("module_code");
    setRows((data ?? []) as Module[]);
  };
  useEffect(() => { load(); }, []);
  const setStatus = async (id: string, status: string) => {
    const patch: any = { current_status: status };
    if (status === "approved_for_beta" || status === "approved_for_production") patch.approved_at = new Date().toISOString();
    const { error } = await supabase.from("sensitive_module_approvals").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Statut mis à jour"); load(); }
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Un module <code>blocked</code> n'est pas activable. Seul le rôle owner_bpei peut faire évoluer un statut.</p>
      <div className="grid gap-2">
        {rows.map(m => (
          <Card key={m.id} className="p-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-medium">{m.module_name} <span className="text-xs text-muted-foreground">({m.module_code})</span></div>
                <div className="text-xs text-muted-foreground">Risque : <Badge variant={m.risk_level === "critical" ? "destructive" : "secondary"}>{m.risk_level}</Badge>{m.notes && <> — {m.notes}</>}</div>
                {m.blockers && <div className="text-xs text-amber-600 mt-1">Bloquants : {m.blockers}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.current_status === "blocked" ? "destructive" : m.current_status.startsWith("approved") ? "default" : "secondary"}>{m.current_status}</Badge>
                <Select value={m.current_status} onValueChange={(v) => setStatus(m.id, v)}>
                  <SelectTrigger className="w-56 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODULE_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ------------------- Roles matrix -------------------
function RolesPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ feature_code: "", feature_name: "", platform_role: "", shop_role: "", notes: "" });
  const load = async () => {
    const { data } = await supabase.from("legal_role_definitions").select("*").order("feature_code");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);
  const submit = async () => {
    if (!form.feature_code || !form.feature_name) { toast.error("Code et nom requis"); return; }
    const { error } = await supabase.from("legal_role_definitions").insert(form);
    if (error) toast.error(error.message); else { toast.success("Rôle ajouté"); setForm({ feature_code: "", feature_name: "", platform_role: "", shop_role: "", notes: "" }); load(); }
  };
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <div className="text-sm font-medium">Nouvelle ligne (modèle préparatoire)</div>
        <div className="grid md:grid-cols-2 gap-2">
          <Input placeholder="Code fonctionnalité" value={form.feature_code} onChange={e => setForm({ ...form, feature_code: e.target.value })} />
          <Input placeholder="Nom" value={form.feature_name} onChange={e => setForm({ ...form, feature_name: e.target.value })} />
          <Input placeholder="Rôle plateforme (ex: éditeur SaaS)" value={form.platform_role} onChange={e => setForm({ ...form, platform_role: e.target.value })} />
          <Input placeholder="Rôle boutique (ex: vendeur / prestataire)" value={form.shop_role} onChange={e => setForm({ ...form, shop_role: e.target.value })} />
        </div>
        <Textarea placeholder="Notes / justification" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        <Button size="sm" onClick={submit}>Ajouter</Button>
      </Card>
      <div className="grid gap-2">
        {rows.map(r => (
          <Card key={r.id} className="p-3 text-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-medium">{r.feature_name} <span className="text-xs text-muted-foreground">({r.feature_code} v{r.version})</span></div>
              <div className="flex gap-1">
                <Badge variant="secondary">{r.legal_validation_status}</Badge>
                <Badge variant={r.activation_status === "production_authorized" ? "default" : "secondary"}>{r.activation_status}</Badge>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Plateforme : {r.platform_role || "—"} · Boutique : {r.shop_role || "—"} · Indépendant : {r.independent_role || "—"}</div>
            {r.notes && <div className="text-xs mt-1">{r.notes}</div>}
          </Card>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Aucun rôle défini. Utiliser le formulaire ci-dessus pour lancer la matrice.</div>}
      </div>
    </div>
  );
}

// ------------------- Decisions -------------------
function DecisionsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", subject: "", description: "", selected_option: "", justification: "" });
  const load = async () => { const { data } = await supabase.from("legal_decisions").select("*").order("created_at", { ascending: false }); setRows(data ?? []); };
  useEffect(() => { load(); }, []);
  const submit = async () => {
    if (!form.title) { toast.error("Titre requis"); return; }
    const { error } = await supabase.from("legal_decisions").insert(form);
    if (error) toast.error(error.message); else { setForm({ title: "", subject: "", description: "", selected_option: "", justification: "" }); load(); }
  };
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <Input placeholder="Titre de la décision" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <Input placeholder="Sujet" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
        <Textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <Input placeholder="Option retenue" value={form.selected_option} onChange={e => setForm({ ...form, selected_option: e.target.value })} />
        <Textarea placeholder="Justification" value={form.justification} onChange={e => setForm({ ...form, justification: e.target.value })} />
        <Button size="sm" onClick={submit}>Enregistrer en brouillon</Button>
      </Card>
      <div className="grid gap-2">
        {rows.map(r => (
          <Card key={r.id} className="p-3 text-sm">
            <div className="flex items-center justify-between gap-2"><div className="font-medium">{r.title}</div><Badge variant="secondary">{r.status}</Badge></div>
            {r.selected_option && <div className="text-xs mt-1">Option : {r.selected_option}</div>}
            {r.justification && <div className="text-xs text-muted-foreground mt-1">{r.justification}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ------------------- Processing (RGPD) -------------------
function ProcessingPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ processing_code: "", processing_name: "", purpose: "", legal_basis: "" });
  const load = async () => { const { data } = await supabase.from("processing_activity_roles").select("*").order("processing_code"); setRows(data ?? []); };
  useEffect(() => { load(); }, []);
  const submit = async () => {
    if (!form.processing_code || !form.processing_name) { toast.error("Code et nom requis"); return; }
    const { error } = await supabase.from("processing_activity_roles").insert(form);
    if (error) toast.error(error.message); else { setForm({ processing_code: "", processing_name: "", purpose: "", legal_basis: "" }); load(); }
  };
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <Input placeholder="Code traitement" value={form.processing_code} onChange={e => setForm({ ...form, processing_code: e.target.value })} />
        <Input placeholder="Nom du traitement" value={form.processing_name} onChange={e => setForm({ ...form, processing_name: e.target.value })} />
        <Textarea placeholder="Finalité" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
        <Input placeholder="Base légale" value={form.legal_basis} onChange={e => setForm({ ...form, legal_basis: e.target.value })} />
        <Button size="sm" onClick={submit}>Ajouter</Button>
      </Card>
      <div className="grid gap-2">
        {rows.map(r => {
          const undetermined = r.platform_role === "to_be_determined" || r.professional_role === "to_be_determined";
          return (
            <Card key={r.id} className={`p-3 text-sm ${undetermined ? "border-amber-500/40" : ""}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap"><div className="font-medium">{r.processing_name} <span className="text-xs text-muted-foreground">({r.processing_code})</span></div><div className="flex gap-1"><Badge variant="secondary">Plateforme: {r.platform_role}</Badge><Badge variant="secondary">Pro: {r.professional_role}</Badge></div></div>
              {r.purpose && <div className="text-xs text-muted-foreground mt-1">{r.purpose}</div>}
              {undetermined && <div className="text-xs text-amber-600 mt-1">Rôle RGPD indéterminé : bloque toute communication publique.</div>}
            </Card>
          );
        })}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Cartographie vide.</div>}
      </div>
    </div>
  );
}

// ------------------- Retention -------------------
function RetentionPanel() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { supabase.from("data_retention_policies").select("*").order("category").then(({ data }) => setRows(data ?? [])); }, []);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Les durées ci-dessous sont des <strong>modèles préparatoires</strong>. À faire valider avant publication.</p>
      <div className="grid gap-2">
        {rows.map(r => (
          <Card key={r.id} className="p-3 text-sm">
            <div className="font-medium capitalize">{r.category}</div>
            <div className="grid md:grid-cols-4 gap-2 mt-1 text-xs">
              <div><span className="text-muted-foreground">Actif :</span> {r.active_retention || "—"}</div>
              <div><span className="text-muted-foreground">Après fin :</span> {r.post_termination_retention || "—"}</div>
              <div><span className="text-muted-foreground">Légal :</span> {r.legal_retention || "—"}</div>
              <div><span className="text-muted-foreground">Sauvegardes :</span> {r.backup_retention || "—"}</div>
            </div>
            {r.justification && <div className="text-xs text-muted-foreground mt-1 italic">{r.justification}</div>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ------------------- Incidents -------------------
function IncidentsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium" });
  const load = async () => { const { data } = await supabase.from("security_incidents").select("*").order("detected_at", { ascending: false }); setRows(data ?? []); };
  useEffect(() => { load(); }, []);
  const submit = async () => {
    if (!form.title) { toast.error("Titre requis"); return; }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("security_incidents").insert({ ...form, detected_by: u.user?.id });
    if (error) toast.error(error.message); else { setForm({ title: "", description: "", severity: "medium" }); load(); }
  };
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <Input placeholder="Titre" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        <Textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{["low", "medium", "high", "critical"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={submit}>Créer incident</Button>
      </Card>
      <div className="grid gap-2">
        {rows.map(r => (
          <Card key={r.id} className="p-3 text-sm">
            <div className="flex items-center justify-between gap-2"><div className="font-medium">{r.title}</div><div className="flex gap-1"><Badge variant={r.severity === "critical" || r.severity === "high" ? "destructive" : "secondary"}>{r.severity}</Badge><Badge variant="secondary">{r.status}</Badge></div></div>
            {r.description && <div className="text-xs text-muted-foreground mt-1">{r.description}</div>}
          </Card>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Aucun incident enregistré.</div>}
      </div>
    </div>
  );
}

// ------------------- Insurance -------------------
function InsurancePanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ insurance_type: "", provider: "", policy_number: "", coverage_amount: "", expiration_date: "" });
  const load = async () => { const { data } = await supabase.from("platform_insurance_records").select("*").order("expiration_date", { ascending: true }); setRows(data ?? []); };
  useEffect(() => { load(); }, []);
  const submit = async () => {
    if (!form.insurance_type) { toast.error("Type requis"); return; }
    const payload: any = { ...form };
    payload.coverage_amount = form.coverage_amount ? Number(form.coverage_amount) : null;
    payload.expiration_date = form.expiration_date || null;
    const { error } = await supabase.from("platform_insurance_records").insert(payload);
    if (error) toast.error(error.message); else { setForm({ insurance_type: "", provider: "", policy_number: "", coverage_amount: "", expiration_date: "" }); load(); }
  };
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Ne jamais afficher publiquement une garantie non couverte par une police active.</p>
        <div className="grid md:grid-cols-2 gap-2">
          <Input placeholder="Type (ex: RC pro SaaS)" value={form.insurance_type} onChange={e => setForm({ ...form, insurance_type: e.target.value })} />
          <Input placeholder="Assureur" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} />
          <Input placeholder="N° police" value={form.policy_number} onChange={e => setForm({ ...form, policy_number: e.target.value })} />
          <Input placeholder="Montant" type="number" value={form.coverage_amount} onChange={e => setForm({ ...form, coverage_amount: e.target.value })} />
          <div>
            <Label className="text-xs">Expiration</Label>
            <Input type="date" value={form.expiration_date} onChange={e => setForm({ ...form, expiration_date: e.target.value })} />
          </div>
        </div>
        <Button size="sm" onClick={submit}>Ajouter</Button>
      </Card>
      <div className="grid gap-2">
        {rows.map(r => {
          const exp = r.expiration_date ? new Date(r.expiration_date) : null;
          const days = exp ? Math.floor((exp.getTime() - Date.now()) / 86400000) : null;
          const tone = days !== null && days < 90 ? "border-amber-500/40" : "";
          return (
            <Card key={r.id} className={`p-3 text-sm ${tone}`}>
              <div className="flex items-center justify-between gap-2"><div className="font-medium">{r.insurance_type}</div><Badge variant="secondary">{r.status}</Badge></div>
              <div className="text-xs text-muted-foreground mt-1">{r.provider || "—"} · {r.policy_number || "—"} · {r.coverage_amount ? `${r.coverage_amount} €` : "—"}</div>
              {exp && <div className={`text-xs mt-1 ${days !== null && days < 90 ? "text-amber-600" : "text-muted-foreground"}`}>Expire le {exp.toLocaleDateString("fr-FR")} {days !== null && `(J${days >= 0 ? "+" : ""}${days})`}</div>}
            </Card>
          );
        })}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Aucune police enregistrée. Renseigner les assurances réelles avant tout affichage public.</div>}
      </div>
    </div>
  );
}

// ------------------- Admin access -------------------
function AdminAccessPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ shop_id: "", reason: "", reason_category: "support" });
  const REASONS = ["support", "security_incident", "verification", "dispute", "legal_obligation", "internal_investigation", "other"];
  const load = async () => { const { data } = await supabase.from("admin_access_sessions").select("*").order("started_at", { ascending: false }).limit(50); setRows(data ?? []); };
  useEffect(() => { load(); }, []);
  const submit = async () => {
    if (!form.reason || form.reason.trim().length < 5) { toast.error("Motif obligatoire (min. 5 caractères)"); return; }
    const { data: u } = await supabase.auth.getUser();
    const payload: any = { reason: form.reason, reason_category: form.reason_category, admin_user_id: u.user?.id };
    if (form.shop_id) payload.shop_id = form.shop_id;
    payload.expires_at = new Date(Date.now() + 60 * 60000).toISOString();
    const { error } = await supabase.from("admin_access_sessions").insert(payload);
    if (error) toast.error(error.message); else { toast.success("Session d'accès enregistrée"); setForm({ shop_id: "", reason: "", reason_category: "support" }); load(); }
  };
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Ouvrir une session d'accès administrateur trace un motif et une durée. Toute action sensible doit ensuite être auditée.</p>
        <Input placeholder="ID boutique (optionnel)" value={form.shop_id} onChange={e => setForm({ ...form, shop_id: e.target.value })} />
        <Select value={form.reason_category} onValueChange={v => setForm({ ...form, reason_category: v })}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Textarea placeholder="Motif (obligatoire)" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        <Button size="sm" onClick={submit}>Ouvrir la session</Button>
      </Card>
      <div className="grid gap-2">
        {rows.map(r => (
          <Card key={r.id} className="p-3 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap"><div className="font-medium">{new Date(r.started_at).toLocaleString("fr-FR")} · {r.reason_category}</div>{r.ended_at ? <Badge variant="secondary">terminée</Badge> : <Badge>active</Badge>}</div>
            <div className="text-muted-foreground mt-1">{r.reason}</div>
            {r.shop_id && <div className="text-muted-foreground">Boutique : {r.shop_id}</div>}
          </Card>
        ))}
        {rows.length === 0 && <div className="text-sm text-muted-foreground">Aucun accès administrateur récent.</div>}
      </div>
    </div>
  );
}