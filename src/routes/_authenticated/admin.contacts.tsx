import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Copy, Mail, Phone, Search, Archive, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/contacts")({
  head: () => ({ meta: [{ title: "Demandes de contact — Admin BPEI" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_platform_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin_bpei")) throw redirect({ to: "/app" });
  },
  component: AdminContactsPage,
});

type Row = {
  id: string;
  reference: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  shop_name: string | null;
  shop_id: string | null;
  city: string | null;
  subject_kind: string;
  status: string;
  priority: string | null;
  message: string;
  internal_note: string | null;
  next_action: string | null;
  next_action_at: string | null;
  origin_path: string | null;
};

const SUBJECT_LABEL: Record<string, string> = {
  particulier: "Particulier",
  boutique: "Boutique",
  rejoindre: "Rejoindre BPEI",
  support: "Support technique",
  commercial: "Commercial",
  reclamation: "Réclamation",
  autre: "Autre",
};
const STATUSES = ["nouvelle", "en_cours", "en_attente", "resolue", "archivee"] as const;
const STATUS_LABEL: Record<string, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  en_attente: "En attente",
  resolue: "Résolue",
  archivee: "Archivée",
};

function AdminContactsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [subject, setSubject] = useState<string>("all");
  const [selected, setSelected] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_submissions")
      .select("id, reference, created_at, first_name, last_name, email, phone, shop_name, shop_id, city, subject_kind, status, priority, message, internal_note, next_action, next_action_at, origin_path")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (subject !== "all" && r.subject_kind !== subject) return false;
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return [r.reference, r.first_name, r.last_name, r.email, r.shop_name, r.city]
      .filter(Boolean).some((v) => v!.toLowerCase().includes(needle));
  }), [rows, q, status, subject]);

  const counts = useMemo(() => ({
    new: rows.filter((r) => r.status === "nouvelle").length,
    in_progress: rows.filter((r) => r.status === "en_cours").length,
    overdue: rows.filter((r) => r.next_action_at && new Date(r.next_action_at) < new Date() && r.status !== "resolue" && r.status !== "archivee").length,
    total: rows.length,
  }), [rows]);

  return (
    <AppShell title="Demandes de contact" subtitle="Toutes les demandes reçues via le formulaire public">
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="ghost"><Link to="/admin">← Console</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/admin/demo-requests">Demandes de démonstration</Link></Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Nouvelles", value: counts.new },
          { label: "En cours", value: counts.in_progress },
          { label: "Rappels dépassés", value: counts.overdue },
          { label: "Total", value: counts.total },
        ].map((s) => (
          <Card key={s.label}><CardContent className="pt-6">
            <div className="text-3xl font-bold text-navy">{s.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3">
            <span>Registre</span>
            <div className="relative ml-auto flex-1 max-w-xs">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Référence, nom, e-mail, boutique…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Sujet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous sujets</SelectItem>
                {Object.entries(SUBJECT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4">Référence</th>
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4">Contact</th>
                    <th className="py-3 pr-4">Sujet</th>
                    <th className="py-3 pr-4">Boutique</th>
                    <th className="py-3 pr-4">Statut</th>
                    <th className="py-3 pr-4">Extrait</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((r) => (
                    <tr key={r.id} className="cursor-pointer hover:bg-secondary/40" onClick={() => setSelected(r)}>
                      <td className="py-3 pr-4 font-mono text-xs">{r.reference}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                      <td className="py-3 pr-4">
                        <div className="font-medium">{r.first_name} {r.last_name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </td>
                      <td className="py-3 pr-4"><Badge variant="secondary">{SUBJECT_LABEL[r.subject_kind] ?? r.subject_kind}</Badge></td>
                      <td className="py-3 pr-4 text-xs">{r.shop_name ?? "—"}</td>
                      <td className="py-3 pr-4"><StatusBadge s={r.status} /></td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground line-clamp-1 max-w-xs">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <ContactDetail row={selected} onClose={() => setSelected(null)} onChanged={() => { load(); }} />
      )}
    </AppShell>
  );
}

function StatusBadge({ s }: { s: string }) {
  const v = s === "resolue" ? "default" : s === "archivee" ? "outline" : s === "nouvelle" ? "destructive" : "secondary";
  return <Badge variant={v as any}>{STATUS_LABEL[s] ?? s}</Badge>;
}

function ContactDetail({ row, onClose, onChanged }: { row: Row; onClose: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState(row.status);
  const [note, setNote] = useState(row.internal_note ?? "");
  const [nextAction, setNextAction] = useState(row.next_action ?? "");
  const [nextAt, setNextAt] = useState(row.next_action_at ? row.next_action_at.slice(0, 16) : "");
  const [priority, setPriority] = useState(row.priority ?? "normal");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("contact_submissions").update({
      status,
      internal_note: note || null,
      next_action: nextAction || null,
      next_action_at: nextAt ? new Date(nextAt).toISOString() : null,
      priority: priority === "normal" ? null : priority,
      handled_at: status === "resolue" || status === "archivee" ? new Date().toISOString() : null,
    }).eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Demande mise à jour");
    onChanged();
    onClose();
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copié"));
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-sm">{row.reference}</span>
            <StatusBadge s={status} />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Contact</div>
            <div className="mt-2 font-medium">{row.first_name} {row.last_name}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(row.email)}><Copy className="mr-1 h-3 w-3" /> {row.email}</Button>
              <Button asChild size="sm" variant="outline"><a href={`mailto:${row.email}`}><Mail className="mr-1 h-3 w-3" /> Mail</a></Button>
              {row.phone && <>
                <Button size="sm" variant="outline" onClick={() => copy(row.phone!)}><Copy className="mr-1 h-3 w-3" /> {row.phone}</Button>
                <Button asChild size="sm" variant="outline"><a href={`tel:${row.phone}`}><Phone className="mr-1 h-3 w-3" /> Appeler</a></Button>
              </>}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              L'envoi automatique n'est pas configuré. Utilisez la copie de l'adresse ou le lien e-mail.
            </p>
          </div>

          {(row.shop_name || row.shop_id) && (
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Boutique concernée</div>
              <div className="mt-1 flex items-center gap-2">
                <span>{row.shop_name ?? "—"}</span>
                {row.shop_id && (
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/b/$shopId" params={{ shopId: row.shop_id }} target="_blank">
                      <ExternalLink className="mr-1 h-3 w-3" /> Fiche
                    </Link>
                  </Button>
                )}
              </div>
              {row.city && <div className="text-xs text-muted-foreground">{row.city}</div>}
            </div>
          )}

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Sujet</div>
            <div className="mt-1">{SUBJECT_LABEL[row.subject_kind] ?? row.subject_kind}</div>
            {row.origin_path && <div className="mt-1 text-xs text-muted-foreground">Origine : {row.origin_path}</div>}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Message</div>
            <p className="mt-1 whitespace-pre-wrap rounded-md border bg-secondary/30 p-3 text-sm">{row.message}</p>
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <div className="text-sm font-semibold">Gestion interne</div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">Statut
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="text-xs">Priorité
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>
            <label className="block text-xs">Prochaine action
              <Input className="mt-1" value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder="Ex. Rappeler le client, envoyer devis…" />
            </label>
            <label className="block text-xs">Date de rappel
              <Input className="mt-1" type="datetime-local" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
            </label>
            <label className="block text-xs">Note interne
              <Textarea className="mt-1" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
              <Button variant="outline" onClick={() => { setStatus("archivee"); setTimeout(save, 0); }} disabled={saving}>
                <Archive className="mr-1 h-3 w-3" /> Archiver
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}