// Panneaux extraits de /owner — utilisés par les routes /owner/*
import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { BETA_END_LABEL } from "@/lib/pricing-plans";
import { useServerFn } from "@tanstack/react-start";
import { seedNetworkS5, cleanupNetworkS5 } from "@/lib/seed-network-s5.functions";

export const APP_STATUS: Record<string, { label: string; className: string }> = {
  nouvelle: { label: "Nouvelle", className: "bg-blue-100 text-blue-800" },
  verification: { label: "Vérification", className: "bg-amber-100 text-amber-800" },
  info_manquante: { label: "Info manquante", className: "bg-orange-100 text-orange-800" },
  validee: { label: "Validée", className: "bg-emerald-100 text-emerald-800" },
  refusee: { label: "Refusée", className: "bg-red-100 text-red-800" },
  invitation_envoyee: { label: "Invitation envoyée", className: "bg-indigo-100 text-indigo-800" },
  acces_active: { label: "Accès actif", className: "bg-emerald-100 text-emerald-800" },
  archivee: { label: "Archivée", className: "bg-slate-100 text-slate-700" },
};

const MODULES = [
  "dashboard","clients","devices","repairs","appointments",
  "quotes","invoices","credit_notes","payments","services",
  "catalog","stock","quarantine","suppliers","purchase_orders",
  "restock","orders","messaging","portal","public_page",
  "reviews","team","search",
];

type Application = {
  id: string; reference: string; status: string;
  contact_first_name: string; contact_last_name: string;
  contact_email: string; contact_phone: string | null;
  commercial_name: string; legal_name: string | null; legal_form: string | null;
  siren: string | null; siret: string | null; city: string | null;
  internal_notes: string | null; created_at: string; shop_id: string | null;
};

type ShopRow = {
  id: string; name: string; public_name: string | null; internal_name: string | null;
  city: string | null; status: string; email: string | null;
  public_status: string; last_seen_at: string | null;
};

type Sub = { plan: string; effective_status: string; ends_at: string | null; days_remaining: number | null; note: string | null };

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>;
}

export function CandidaturesTab() {
  const [apps, setApps] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("shop_applications").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setApps((data ?? []) as Application[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function validate(app: Application) {
    if (!confirm(`Valider ${app.commercial_name} et activer la bêta Pro (gratuit jusqu'au ${BETA_END_LABEL}) ?`)) return;
    const { data, error } = await supabase.rpc("owner_validate_application", { _application_id: app.id, _activate_beta: true });
    if (error) return toast.error(error.message);
    const result = data as { invitation_url?: string; invitation_token?: string; auto_attached?: boolean };
    if (result.auto_attached) toast.success(`${app.commercial_name} : accès activé directement (compte existant).`);
    else if (result.invitation_url) {
      const fullUrl = `${window.location.origin}${result.invitation_url}`;
      await navigator.clipboard.writeText(fullUrl).catch(() => {});
      toast.success("Boutique créée. Lien d'invitation copié.");
    }
    setSelected(null); load();
  }
  async function refuse(app: Application) {
    const reason = prompt("Motif de refus (optionnel) :") ?? "";
    const { error } = await supabase.rpc("owner_refuse_application", { _application_id: app.id, _reason: reason || undefined });
    if (error) return toast.error(error.message);
    toast.success("Candidature refusée"); setSelected(null); load();
  }
  async function archive(app: Application) {
    const { error } = await supabase.rpc("owner_archive_application", { _application_id: app.id });
    if (error) return toast.error(error.message);
    toast.success("Archivée"); setSelected(null); load();
  }
  async function saveNotes(app: Application) {
    const { error } = await supabase.rpc("owner_update_application_notes", { _application_id: app.id, _notes: notes });
    if (error) return toast.error(error.message);
    toast.success("Notes enregistrées"); load();
  }
  async function regenInvite(app: Application) {
    if (!app.shop_id) return;
    const { data, error } = await supabase.rpc("owner_regenerate_invitation", { _shop_id: app.shop_id, _email: app.contact_email });
    if (error) return toast.error(error.message);
    const url = `${window.location.origin}/portail/invitation/${data}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Nouveau lien copié");
  }

  return (
    <Card>
      <CardHeader><CardTitle>Candidatures ({apps.length})</CardTitle></CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : apps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune candidature.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-2">Référence</th><th className="p-2">Date</th><th className="p-2">Boutique</th><th className="p-2">Responsable</th><th className="p-2">Statut</th><th className="p-2"></th></tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-secondary/40">
                    <td className="p-2 font-mono text-xs">{a.reference}</td>
                    <td className="p-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                    <td className="p-2"><div className="font-medium">{a.commercial_name}</div><div className="text-xs text-muted-foreground">{a.city ?? "—"}</div></td>
                    <td className="p-2"><div>{a.contact_first_name} {a.contact_last_name}</div><div className="text-xs text-muted-foreground">{a.contact_email}</div></td>
                    <td className="p-2"><Badge className={APP_STATUS[a.status]?.className}>{APP_STATUS[a.status]?.label ?? a.status}</Badge></td>
                    <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={() => { setSelected(a); setNotes(a.internal_notes ?? ""); }}>Ouvrir</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.commercial_name} — {selected.reference}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Responsable" value={`${selected.contact_first_name} ${selected.contact_last_name}`} />
                  <Info label="Email" value={selected.contact_email} />
                  <Info label="Téléphone" value={selected.contact_phone ?? "—"} />
                  <Info label="Ville" value={selected.city ?? "—"} />
                  <Info label="SIREN" value={selected.siren ?? "—"} />
                  <Info label="SIRET" value={selected.siret ?? "—"} />
                  <Info label="Raison sociale" value={selected.legal_name ?? "—"} />
                  <Info label="Forme" value={selected.legal_form ?? "—"} />
                </div>
                <div className="space-y-2">
                  <Label>Notes internes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
                  <Button size="sm" variant="outline" onClick={() => saveNotes(selected)}>Enregistrer les notes</Button>
                </div>
              </div>
              <DialogFooter className="flex-wrap gap-2">
                {selected.status !== "acces_active" && selected.status !== "archivee" && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => validate(selected)}>Valider et activer la bêta Pro</Button>
                )}
                {selected.shop_id && (
                  <Button variant="outline" onClick={() => regenInvite(selected)}><Copy className="mr-1 h-3 w-3" />Régénérer invitation</Button>
                )}
                {selected.status !== "refusee" && selected.status !== "archivee" && (
                  <Button variant="outline" onClick={() => refuse(selected)}>Refuser</Button>
                )}
                <Button variant="ghost" onClick={() => archive(selected)}>Archiver</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function ShopsTab() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [subs, setSubs] = useState<Record<string, Sub | null>>({});
  const [selected, setSelected] = useState<ShopRow | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("shops").select("id, name, public_name, internal_name, city, status, email, public_status, last_seen_at").order("name");
    const list = (data ?? []) as ShopRow[];
    setShops(list);
    const entries = await Promise.all(list.map(async (s) => {
      const { data: sub } = await supabase.rpc("shop_subscription_state", { _shop: s.id });
      return [s.id, sub as Sub | null] as const;
    }));
    setSubs(Object.fromEntries(entries));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function extend(shopId: string) {
    const days = prompt("Prolonger de combien de jours ?", "30"); if (!days) return;
    const n = parseInt(days, 10); if (!Number.isFinite(n)) return;
    const newEnd = new Date(Date.now() + n * 86400_000).toISOString();
    const { error } = await supabase.rpc("owner_extend_subscription", { _shop_id: shopId, _new_end: newEnd, _note: `Prolongation de ${n} jours` });
    if (error) return toast.error(error.message);
    toast.success("Abonnement prolongé"); load();
  }
  async function activatePaid(shopId: string) {
    const months = prompt("Activer paiement — combien de mois ?", "12"); if (!months) return;
    const n = parseInt(months, 10); if (!Number.isFinite(n)) return;
    const newEnd = new Date(Date.now() + n * 30 * 86400_000).toISOString();
    const { error } = await supabase.rpc("owner_activate_paid", { _shop_id: shopId, _plan: "pro", _ends_at: newEnd, _note: `Paiement vérifié — ${n} mois` });
    if (error) return toast.error(error.message);
    toast.success("Abonnement Pro payant activé"); load();
  }
  async function suspend(shopId: string) {
    const reason = prompt("Motif de suspension :"); if (reason === null) return;
    const { error } = await supabase.rpc("owner_suspend_subscription", { _shop_id: shopId, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Suspendue"); load();
  }
  async function reactivate(shopId: string) {
    const { error } = await supabase.rpc("owner_reactivate_subscription", { _shop_id: shopId });
    if (error) return toast.error(error.message);
    toast.success("Réactivée"); load();
  }
  async function saveNames(shopId: string, publicName: string, internalName: string, publicStatus: string) {
    const { error } = await supabase.rpc("owner_update_shop_names", { _shop_id: shopId, _public_name: publicName, _internal_name: internalName, _public_status: publicStatus });
    if (error) return toast.error(error.message);
    toast.success("Enregistré"); setSelected(null); load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Boutiques ({shops.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-2">Nom interne</th><th className="p-2">Public</th><th className="p-2">Ville</th><th className="p-2">Statut</th><th className="p-2">Abonnement</th><th className="p-2">Jours restants</th><th className="p-2"></th></tr>
            </thead>
            <tbody>
              {shops.map((s) => {
                const sub = subs[s.id];
                return (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2"><div className="font-medium">{s.internal_name || s.name}</div><div className="text-xs text-muted-foreground">{s.email}</div></td>
                    <td className="p-2"><div>{s.public_name || "—"}</div><Badge variant={s.public_status === "published" ? "default" : "outline"}>{s.public_status}</Badge></td>
                    <td className="p-2 text-xs">{s.city ?? "—"}</td>
                    <td className="p-2"><Badge variant={s.status === "validated" ? "default" : "secondary"}>{s.status}</Badge></td>
                    <td className="p-2 text-xs">{sub ? <><Badge>{sub.plan}</Badge> <span className="ml-1">{sub.effective_status}</span></> : "—"}</td>
                    <td className="p-2 text-xs">{sub?.days_remaining ?? "—"}</td>
                    <td className="p-2 text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setSelected(s)}>Ouvrir</Button>
                      <Button size="sm" variant="ghost" onClick={() => extend(s.id)}>Prolonger</Button>
                      <Button size="sm" variant="ghost" onClick={() => activatePaid(s.id)}>Activer payant</Button>
                      {sub?.effective_status === "suspended" ?
                        <Button size="sm" variant="ghost" onClick={() => reactivate(s.id)}>Réactiver</Button> :
                        <Button size="sm" variant="ghost" onClick={() => suspend(s.id)}>Suspendre</Button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>{selected && <ShopEditForm shop={selected} onSave={saveNames} />}</DialogContent>
      </Dialog>
    </Card>
  );
}

function ShopEditForm({ shop, onSave }: { shop: ShopRow; onSave: (id: string, publicName: string, internalName: string, publicStatus: string) => void }) {
  const [publicName, setPublicName] = useState(shop.public_name ?? "");
  const [internalName, setInternalName] = useState(shop.internal_name ?? "");
  const [publicStatus, setPublicStatus] = useState(shop.public_status);
  return (
    <>
      <DialogHeader><DialogTitle>{shop.name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nom public</Label><Input value={publicName} onChange={(e) => setPublicName(e.target.value)} /></div>
        <div><Label>Nom interne BPEI</Label><Input value={internalName} onChange={(e) => setInternalName(e.target.value)} /></div>
        <div className="flex items-center gap-2">
          <Switch checked={publicStatus === "published"} onCheckedChange={(v) => setPublicStatus(v ? "published" : "draft")} />
          <Label>Page publique {publicStatus === "published" ? "publiée" : "en brouillon"}</Label>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to={`/b/${shop.id}` as unknown as string}><ExternalLink className="mr-1 h-3 w-3" />Voir la fiche publique</Link></Button>
        </div>
      </div>
      <DialogFooter><Button onClick={() => onSave(shop.id, publicName, internalName, publicStatus)}>Enregistrer</Button></DialogFooter>
    </>
  );
}

export function ModulesTab() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [modulesByShop, setModulesByShop] = useState<Record<string, Record<string, boolean>>>({});
  const [selectedShop, setSelectedShop] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("shops").select("id, name, public_name, internal_name, city, status, email, public_status, last_seen_at").eq("status", "validated").order("name");
      setShops((data ?? []) as ShopRow[]);
    })();
  }, []);
  useEffect(() => {
    if (!selectedShop) return;
    (async () => {
      const { data } = await supabase.from("shop_enabled_modules").select("module_key, enabled").eq("shop_id", selectedShop);
      const map: Record<string, boolean> = {};
      for (const m of MODULES) map[m] = true;
      for (const r of data ?? []) map[r.module_key] = r.enabled;
      setModulesByShop((prev) => ({ ...prev, [selectedShop]: map }));
    })();
  }, [selectedShop]);
  async function toggle(shopId: string, module: string, enabled: boolean) {
    const { error } = await supabase.rpc("owner_toggle_module", { _shop_id: shopId, _module: module, _enabled: enabled });
    if (error) return toast.error(error.message);
    setModulesByShop((prev) => ({ ...prev, [shopId]: { ...(prev[shopId] ?? {}), [module]: enabled } }));
    toast.success("Module mis à jour");
  }
  const map = selectedShop ? modulesByShop[selectedShop] ?? {} : {};
  return (
    <div className="grid gap-4 md:grid-cols-[240px_1fr]">
      <Card><CardHeader><CardTitle className="text-sm">Boutiques</CardTitle></CardHeader><CardContent className="space-y-1">
        {shops.map((s) => (
          <button key={s.id} onClick={() => setSelectedShop(s.id)}
            className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${selectedShop === s.id ? "bg-navy text-navy-foreground" : "hover:bg-secondary"}`}>
            {s.internal_name || s.name}
          </button>
        ))}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Modules {selectedShop ? "" : "— sélectionnez une boutique"}</CardTitle></CardHeader><CardContent>
        {selectedShop ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULES.map((m) => (
              <div key={m} className="flex items-center justify-between rounded-md border border-border p-2">
                <span className="text-sm">{m}</span>
                <Switch checked={map[m] ?? true} onCheckedChange={(v) => toggle(selectedShop, m, v)} />
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Sélectionnez une boutique à gauche.</p>}
      </CardContent></Card>
    </div>
  );
}

export function HistoryTab() {
  const [rows, setRows] = useState<Array<{ id: string; created_at: string; action: string; shop_id: string | null; new_value: unknown; note: string | null; reason: string | null }>>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("owner_audit_log").select("id, created_at, action, shop_id, new_value, note, reason").order("created_at", { ascending: false }).limit(200);
      setRows(data ?? []);
    })();
  }, []);
  return (
    <Card>
      <CardHeader><CardTitle>Historique ({rows.length})</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Date</th><th className="p-2">Action</th><th className="p-2">Boutique</th><th className="p-2">Détail</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2 text-xs">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                <td className="p-2 font-medium">{r.action}</td>
                <td className="p-2 text-xs font-mono">{r.shop_id?.slice(0, 8) ?? "—"}</td>
                <td className="p-2 text-xs text-muted-foreground">{r.note ?? r.reason ?? (r.new_value ? JSON.stringify(r.new_value).slice(0, 100) : "")}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-sm text-muted-foreground">Aucune action enregistrée.</td></tr>}
          </tbody>
        </table></div>
      </CardContent>
    </Card>
  );
}

type PubShop = { id: string; name: string; public_name: string | null; public_profile_status: string; publication_requested_at: string | null; publication_notes: string | null; city: string | null; };

export function PublicationsTab() {
  const [rows, setRows] = useState<PubShop[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("shops").select("id, name, public_name, public_profile_status, publication_requested_at, publication_notes, city").in("public_profile_status", ["pending_review", "published"]).order("publication_requested_at", { ascending: false, nullsFirst: false });
    setRows((data ?? []) as PubShop[]); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function approve(s: PubShop) {
    const notes = prompt("Note interne (optionnel) :") ?? "";
    const { error } = await supabase.rpc("owner_approve_publication", { _shop_id: s.id, _notes: notes || undefined });
    if (error) return toast.error(error.message);
    toast.success("Page publiée"); load();
  }
  async function reject(s: PubShop) {
    const notes = prompt("Motif du refus (au moins 5 caractères) :");
    if (!notes || notes.trim().length < 5) return;
    const { error } = await supabase.rpc("owner_reject_publication", { _shop_id: s.id, _notes: notes });
    if (error) return toast.error(error.message);
    toast.success("Publication refusée"); load();
  }
  async function unpublish(s: PubShop) {
    if (!confirm(`Dépublier ${s.public_name || s.name} ?`)) return;
    const { error } = await supabase.rpc("shop_unpublish", { _shop_id: s.id });
    if (error) return toast.error(error.message);
    toast.success("Page dépubliée"); load();
  }
  const pending = rows.filter((r) => r.public_profile_status === "pending_review");
  const published = rows.filter((r) => r.public_profile_status === "published");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Demandes de publication ({pending.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-2">Boutique</th><th className="p-2">Ville</th><th className="p-2">Demande</th><th className="p-2">Note</th><th className="p-2"></th></tr>
              </thead>
              <tbody>
                {pending.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2 font-medium">{s.public_name || s.name}</td>
                    <td className="p-2 text-xs">{s.city ?? "—"}</td>
                    <td className="p-2 text-xs">{s.publication_requested_at ? new Date(s.publication_requested_at).toLocaleString("fr-FR") : "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{s.publication_notes ?? ""}</td>
                    <td className="p-2 text-right space-x-1">
                      <Button size="sm" asChild variant="ghost"><a href={`/b/${s.id}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3 w-3" />Aperçu</a></Button>
                      <Button size="sm" onClick={() => approve(s)} className="bg-emerald-600 hover:bg-emerald-700">Publier</Button>
                      <Button size="sm" variant="outline" onClick={() => reject(s)}>Refuser</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Boutiques publiées ({published.length})</CardTitle></CardHeader>
        <CardContent>
          {published.length === 0 ? <p className="text-sm text-muted-foreground">Aucune boutique publiée.</p> : (
            <ul className="space-y-1 text-sm">
              {published.map((s) => (
                <li key={s.id} className="flex items-center justify-between border-t border-border py-2">
                  <span>{s.public_name || s.name} {s.city && <span className="text-muted-foreground">— {s.city}</span>}</span>
                  <div className="flex gap-1">
                    <Button size="sm" asChild variant="ghost"><a href={`/b/${s.id}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3 w-3" />Voir</a></Button>
                    <Button size="sm" variant="outline" onClick={() => unpublish(s)}>Dépublier</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type LegalShop = { id: string; name: string; public_name: string | null; legal_status: string; legal_submitted_at: string | null; legal_notes: string | null; legal_name: string | null; legal_form: string | null; siret: string | null; vat_number: string | null; };

export function LegalTab() {
  const [rows, setRows] = useState<LegalShop[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("shops").select("id, name, public_name, legal_status, legal_submitted_at, legal_notes, legal_name, legal_form, siret, vat_number").neq("legal_status", "draft").order("legal_submitted_at", { ascending: false, nullsFirst: false });
    setRows((data ?? []) as LegalShop[]); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function approve(s: LegalShop) {
    const notes = prompt("Note (optionnel) :") ?? "";
    const { error } = await supabase.rpc("owner_approve_legal", { _shop_id: s.id, _notes: notes || undefined });
    if (error) return toast.error(error.message);
    toast.success("Dossier validé"); load();
  }
  async function reject(s: LegalShop) {
    const notes = prompt("Motif du refus (au moins 5 caractères) :");
    if (!notes || notes.trim().length < 5) return;
    const { error } = await supabase.rpc("owner_reject_legal", { _shop_id: s.id, _notes: notes });
    if (error) return toast.error(error.message);
    toast.success("Dossier refusé"); load();
  }
  const pending = rows.filter((r) => r.legal_status === "submitted");
  const done = rows.filter((r) => r.legal_status !== "submitted");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Dossiers à valider ({pending.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun dossier en attente.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-2">Boutique</th><th className="p-2">Raison sociale</th><th className="p-2">Forme</th><th className="p-2">SIRET</th><th className="p-2">TVA</th><th className="p-2">Reçu le</th><th className="p-2"></th></tr>
              </thead>
              <tbody>
                {pending.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="p-2 font-medium">{s.public_name || s.name}</td>
                    <td className="p-2">{s.legal_name}</td>
                    <td className="p-2">{s.legal_form}</td>
                    <td className="p-2 font-mono text-xs">{s.siret}</td>
                    <td className="p-2 font-mono text-xs">{s.vat_number ?? "—"}</td>
                    <td className="p-2 text-xs">{s.legal_submitted_at ? new Date(s.legal_submitted_at).toLocaleString("fr-FR") : "—"}</td>
                    <td className="p-2 text-right space-x-1">
                      <Button size="sm" onClick={() => approve(s)} className="bg-emerald-600 hover:bg-emerald-700">Valider</Button>
                      <Button size="sm" variant="outline" onClick={() => reject(s)}>Refuser</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Historique dossiers ({done.length})</CardTitle></CardHeader>
        <CardContent>
          {done.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <ul className="space-y-1 text-sm">
              {done.map((s) => (
                <li key={s.id} className="flex items-center justify-between border-t border-border py-2">
                  <span>{s.public_name || s.name} — <Badge variant={s.legal_status === "approved" ? "default" : "outline"}>{s.legal_status}</Badge></span>
                  <span className="text-xs text-muted-foreground">{s.legal_notes ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type VerifRow = { id: string; name: string; public_name: string | null; business_type: string | null; verification_status: string; verification_submitted_at: string | null; verification_notes: string | null; city: string | null; email: string | null; phone: string | null; };

export function VerificationsTab() {
  const [rows, setRows] = useState<VerifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [docsOpen, setDocsOpen] = useState<string | null>(null);
  const [docs, setDocs] = useState<Array<{ id: string; document_type: string; original_filename: string | null; storage_path: string; review_status: string; created_at: string }>>([]);
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("shops").select("id, name, public_name, business_type, verification_status, verification_submitted_at, verification_notes, city, email, phone").in("verification_status", ["pending", "verified", "rejected", "suspended"]).order("verification_submitted_at", { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    setRows((data as VerifRow[]) ?? []); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  async function decide(shopId: string, decision: "verified" | "rejected" | "suspended" | "reset") {
    const notes = notesById[shopId];
    if ((decision === "rejected" || decision === "suspended") && !notes) { toast.error("Ajoutez une note pour justifier la décision."); return; }
    const { error } = await supabase.rpc("owner_review_verification", { _shop_id: shopId, _decision: decision, _notes: notes || undefined });
    if (error) return toast.error(error.message);
    toast.success("Décision enregistrée.");
    setNotesById((n) => ({ ...n, [shopId]: "" })); load();
  }
  async function openDocs(shopId: string) {
    setDocsOpen(shopId);
    const { data, error } = await supabase.from("verification_documents").select("id, document_type, original_filename, storage_path, review_status, created_at").eq("shop_id", shopId).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setDocs(data ?? []);
  }
  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from("shop-verification").createSignedUrl(path, 300);
    if (error || !data) return toast.error(error?.message ?? "URL indisponible");
    window.open(data.signedUrl, "_blank", "noopener");
  }
  const pending = rows.filter((r) => r.verification_status === "pending");
  const done = rows.filter((r) => r.verification_status !== "pending");
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Dossiers en attente ({pending.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Chargement…</p>
            : pending.length === 0 ? <p className="text-sm text-muted-foreground">Aucun dossier en attente.</p>
            : (
              <ul className="space-y-3">
                {pending.map((s) => (
                  <li key={s.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{s.public_name || s.name}</strong>
                      <Badge variant="outline">{s.business_type ?? "—"}</Badge>
                      <span className="text-xs text-muted-foreground">{s.city ?? ""}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {s.verification_submitted_at ? new Date(s.verification_submitted_at).toLocaleString("fr-FR") : "—"}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{s.email} · {s.phone}</div>
                    <Textarea className="mt-2" rows={2} placeholder="Notes (obligatoire pour refus/suspension)"
                      value={notesById[s.id] ?? ""}
                      onChange={(e) => setNotesById((n) => ({ ...n, [s.id]: e.target.value }))} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openDocs(s.id)}>Voir documents</Button>
                      <Button size="sm" onClick={() => decide(s.id, "verified")}>Valider</Button>
                      <Button size="sm" variant="destructive" onClick={() => decide(s.id, "rejected")}>Refuser</Button>
                      <Button size="sm" variant="outline" onClick={() => decide(s.id, "suspended")}>Suspendre</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Historique ({done.length})</CardTitle></CardHeader>
        <CardContent>
          {done.length === 0 ? <p className="text-sm text-muted-foreground">Aucun dossier traité.</p> : (
            <ul className="space-y-2 text-sm">
              {done.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-b-0">
                  <span className="flex items-center gap-2">
                    <strong>{s.public_name || s.name}</strong>
                    <Badge variant={s.verification_status === "verified" ? "default" : "outline"}>{s.verification_status}</Badge>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{s.verification_notes ?? ""}</span>
                    <Button size="sm" variant="ghost" onClick={() => openDocs(s.id)}>Documents</Button>
                    <Button size="sm" variant="ghost" onClick={() => decide(s.id, "reset")}>Réinitialiser</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!docsOpen} onOpenChange={(o) => !o && setDocsOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Documents du dossier</DialogTitle></DialogHeader>
          {docs.length === 0 ? <p className="text-sm text-muted-foreground">Aucun document.</p> : (
            <ul className="divide-y divide-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{d.document_type}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.original_filename ?? d.storage_path.split("/").pop()} · {new Date(d.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{d.review_status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => openDoc(d.storage_path)}>Ouvrir</Button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDocsOpen(null)}>Fermer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PartnershipsTab() {
  const [opps, setOpps] = useState<any[]>([]);
  const [apps, setApps] = useState<any[]>([]);
  const [agrs, setAgrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [o, a, g] = await Promise.all([
        supabase.from("partner_opportunities").select("id, title, status, shop_id, created_at, specialties, covered_cities").order("created_at", { ascending: false }).limit(200),
        supabase.from("partner_applications").select("id, status, opportunity_id, independent_shop_id, created_at, message").order("created_at", { ascending: false }).limit(200),
        supabase.from("partner_agreements").select("id, title, status, shop_id, independent_shop_id, shop_signed_at, independent_signed_at, created_at, suspended_reason, end_date").order("created_at", { ascending: false }).limit(200),
      ]);
      const shopIds = Array.from(new Set([
        ...(o.data ?? []).map((x: any) => x.shop_id),
        ...(a.data ?? []).map((x: any) => x.independent_shop_id),
        ...(g.data ?? []).flatMap((x: any) => [x.shop_id, x.independent_shop_id]),
      ]));
      const shopMap = new Map<string, any>();
      if (shopIds.length) {
        const { data: shops } = await supabase.from("shops").select("id, public_name, name, city, business_type").in("id", shopIds);
        (shops ?? []).forEach((s: any) => shopMap.set(s.id, s));
      }
      const oppMap = new Map<string, any>((o.data ?? []).map((x: any) => [x.id, x]));
      setOpps((o.data ?? []).map((x: any) => ({ ...x, shop: shopMap.get(x.shop_id) })));
      setApps((a.data ?? []).map((x: any) => ({ ...x, opportunity: oppMap.get(x.opportunity_id), independent: shopMap.get(x.independent_shop_id) })));
      setAgrs((g.data ?? []).map((x: any) => ({ ...x, shop: shopMap.get(x.shop_id), independent: shopMap.get(x.independent_shop_id) })));
      setLoading(false);
    })();
  }, [reloadKey]);
  const refresh = () => setReloadKey((k) => k + 1);
  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(label);
    try {
      const { error } = await fn();
      if (error) throw error;
      toast.success("Action effectuée."); refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally { setBusy(null); }
  };
  const suspend = (id: string) => {
    const reason = prompt("Motif de suspension (min 3 caractères) :");
    if (!reason || reason.trim().length < 3) return;
    run(`sus-${id}`, async () => await supabase.rpc("partner_owner_suspend_agreement", { _agreement_id: id, _reason: reason }));
  };
  const reactivate = (id: string) => {
    const note = prompt("Note de réactivation :") ?? "";
    run(`rea-${id}`, async () => await supabase.rpc("partner_owner_reactivate_agreement", { _agreement_id: id, _note: note }));
  };
  const forceExpire = (id: string) => {
    const reason = prompt("Motif de l'expiration forcée (min 3 caractères) :");
    if (!reason || reason.trim().length < 3) return;
    run(`exp-${id}`, async () => await supabase.rpc("partner_owner_force_expire_agreement", { _agreement_id: id, _reason: reason }));
  };
  const batchExpire = () => {
    if (!confirm("Passer tous les accords dont la date de fin est dépassée à l'état « expiré » ?")) return;
    run("batch", async () => {
      const r = await supabase.rpc("partner_owner_expire_due_agreements");
      if (!r.error) toast.info(`Accords expirés : ${r.data ?? 0}`);
      return r;
    });
  };
  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Opportunités ({opps.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Titre</th><th>Boutique</th><th>Statut</th><th>Créée</th></tr>
            </thead>
            <tbody>
              {opps.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="py-2">{o.title}</td>
                  <td>{o.shop?.public_name || o.shop?.name || "—"} <span className="text-xs text-muted-foreground">{o.shop?.city ?? ""}</span></td>
                  <td><Badge variant="outline">{o.status}</Badge></td>
                  <td className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
              {opps.length === 0 ? <tr><td colSpan={4} className="py-4 text-sm text-muted-foreground">Aucune opportunité.</td></tr> : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Candidatures ({apps.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Opportunité</th><th>Indépendant</th><th>Statut</th><th>Créée</th></tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-2">{a.opportunity?.title ?? "—"}</td>
                  <td>{a.independent?.public_name || a.independent?.name || "—"}</td>
                  <td><Badge variant="outline">{a.status}</Badge></td>
                  <td className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
              {apps.length === 0 ? <tr><td colSpan={4} className="py-4 text-sm text-muted-foreground">Aucune candidature.</td></tr> : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Accords ({agrs.length})</CardTitle>
          <Button size="sm" variant="outline" disabled={busy === "batch"} onClick={batchExpire}>
            {busy === "batch" ? "…" : "Expirer les accords échus"}
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Titre</th><th>Boutique</th><th>Indépendant</th><th>Signatures</th><th>Statut</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {agrs.map((a) => {
                const canSuspend = a.status === "active";
                const canReactivate = a.status === "suspended";
                const canExpire = !["expired","terminated"].includes(a.status);
                return (
                  <tr key={a.id} className="border-t align-top">
                    <td className="py-2">
                      <div>{a.title}</div>
                      {a.suspended_reason ? <div className="text-xs text-amber-700">Suspendu : {a.suspended_reason}</div> : null}
                      {a.end_date ? <div className="text-xs text-muted-foreground">Fin : {new Date(a.end_date).toLocaleDateString("fr-FR")}</div> : null}
                    </td>
                    <td>{a.shop?.public_name || a.shop?.name || "—"}</td>
                    <td>{a.independent?.public_name || a.independent?.name || "—"}</td>
                    <td className="text-xs">
                      {a.shop_signed_at ? "B✓" : "B·"} {a.independent_signed_at ? "I✓" : "I·"}
                    </td>
                    <td><Badge variant="outline">{a.status}</Badge></td>
                    <td className="text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        {canSuspend ? <Button size="sm" variant="outline" disabled={busy === `sus-${a.id}`} onClick={() => suspend(a.id)}>Suspendre</Button> : null}
                        {canReactivate ? <Button size="sm" variant="outline" disabled={busy === `rea-${a.id}`} onClick={() => reactivate(a.id)}>Réactiver</Button> : null}
                        {canExpire ? <Button size="sm" variant="destructive" disabled={busy === `exp-${a.id}`} onClick={() => forceExpire(a.id)}>Expirer</Button> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {agrs.length === 0 ? <tr><td colSpan={6} className="py-4 text-sm text-muted-foreground">Aucun accord.</td></tr> : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export function TestsS5Tab() {
  const seed = useServerFn(seedNetworkS5);
  const cleanup = useServerFn(cleanupNetworkS5);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const run = useCallback(async (label: string, fn: () => Promise<any>) => {
    setBusy(true); setResult("");
    try {
      const r = await fn();
      setResult(JSON.stringify(r, null, 2));
      toast.success(`${label} : OK`);
    } catch (e: any) {
      setResult(String(e?.message ?? e));
      toast.error(`${label} : ${e?.message ?? e}`);
    } finally { setBusy(false); }
  }, []);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Seed sous-lot 5-ter</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Provisionne 8 comptes Auth <code>test.*@bpei.test</code> distincts, avec leurs boutiques,
            plans et rôles. Idempotent — sûr à ré-exécuter. Mot de passe unique documenté dans le rapport 5-ter.
          </p>
          <div className="flex gap-2">
            <Button data-testid="btn-seed-network-s5" disabled={busy} onClick={() => run("Seed", () => seed({ data: {} } as any))}>
              {busy ? "…" : "Exécuter le seed"}
            </Button>
            <Button data-testid="btn-cleanup-network-s5" variant="outline" disabled={busy} onClick={() => run("Cleanup", () => cleanup({ data: {} } as any))}>
              Cleanup (supprime tous les comptes @bpei.test)
            </Button>
          </div>
          {result ? (
            <pre data-testid="seed-result" className="max-h-96 overflow-auto rounded bg-muted p-3 text-xs">{result}</pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}