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
import { Copy, Mail, Phone, Search, Archive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/demo-requests")({
  head: () => ({ meta: [{ title: "Demandes de démonstration — Admin BPEI" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_platform_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin_bpei")) throw redirect({ to: "/app" });
  },
  component: AdminDemoPage,
});

type Row = {
  id: string;
  reference: string;
  created_at: string;
  first_name: string;
  last_name: string;
  shop_name: string;
  city: string | null;
  email: string;
  phone: string;
  establishments_count: number | null;
  preferred_slot: string | null;
  message: string | null;
  status: string;
  priority: string | null;
  internal_note: string | null;
  next_action: string | null;
  next_action_at: string | null;
};

const STATUSES = ["nouvelle", "contactee", "demo_prevue", "acceptee", "refusee", "archivee"] as const;
const STATUS_LABEL: Record<string, string> = {
  nouvelle: "Nouvelle",
  contactee: "Contactée",
  demo_prevue: "Démo prévue",
  acceptee: "Acceptée",
  refusee: "Refusée",
  archivee: "Archivée",
};

function AdminDemoPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Row | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("demo_requests")
      .select("id, reference, created_at, first_name, last_name, shop_name, city, email, phone, establishments_count, preferred_slot, message, status, priority, internal_note, next_action, next_action_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (!q.trim()) return true;
    const n = q.toLowerCase();
    return [r.reference, r.first_name, r.last_name, r.email, r.shop_name, r.city]
      .filter(Boolean).some((v) => v!.toLowerCase().includes(n));
  }), [rows, q, status]);

  const counts = useMemo(() => ({
    new: rows.filter((r) => r.status === "nouvelle").length,
    scheduled: rows.filter((r) => r.status === "demo_prevue").length,
    overdue: rows.filter((r) => r.next_action_at && new Date(r.next_action_at) < new Date() && !["acceptee","refusee","archivee"].includes(r.status)).length,
    total: rows.length,
  }), [rows]);

  return (
    <AppShell title="Demandes de démonstration" subtitle="Toutes les demandes reçues par la page Professionnels">
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="ghost"><Link to="/admin">← Console</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/admin/contacts">Demandes de contact</Link></Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Nouvelles", value: counts.new },
          { label: "Démos prévues", value: counts.scheduled },
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
              <Input placeholder="Référence, nom, boutique, ville…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
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
                    <th className="py-3 pr-4">Boutique</th>
                    <th className="py-3 pr-4">Ville</th>
                    <th className="py-3 pr-4">Étab.</th>
                    <th className="py-3 pr-4">Créneau</th>
                    <th className="py-3 pr-4">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((r) => (
                    <tr key={r.id} className="cursor-pointer hover:bg-secondary/40" onClick={() => setSelected(r)}>
                      <td className="py-3 pr-4 font-mono text-xs">{r.reference}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="py-3 pr-4">
                        <div className="font-medium">{r.first_name} {r.last_name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </td>
                      <td className="py-3 pr-4">{r.shop_name}</td>
                      <td className="py-3 pr-4">{r.city ?? "—"}</td>
                      <td className="py-3 pr-4">{r.establishments_count ?? "—"}</td>
                      <td className="py-3 pr-4 text-xs">{r.preferred_slot ?? "—"}</td>
                      <td className="py-3 pr-4"><StatusBadge s={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && <DemoDetail row={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </AppShell>
  );
}

function StatusBadge({ s }: { s: string }) {
  const v = s === "acceptee" ? "default" : s === "refusee" || s === "archivee" ? "outline" : s === "nouvelle" ? "destructive" : "secondary";
  return <Badge variant={v as any}>{STATUS_LABEL[s] ?? s}</Badge>;
}

function DemoDetail({ row, onClose, onChanged }: { row: Row; onClose: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState(row.status);
  const [priority, setPriority] = useState(row.priority ?? "normal");
  const [note, setNote] = useState(row.internal_note ?? "");
  const [nextAction, setNextAction] = useState(row.next_action ?? "");
  const [nextAt, setNextAt] = useState(row.next_action_at ? row.next_action_at.slice(0, 16) : "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("demo_requests").update({
      status,
      priority: priority === "normal" ? null : priority,
      internal_note: note || null,
      next_action: nextAction || null,
      next_action_at: nextAt ? new Date(nextAt).toISOString() : null,
      handled_at: ["acceptee","refusee","archivee"].includes(status) ? new Date().toISOString() : null,
    }).eq("id", row.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Mise à jour enregistrée");
    onChanged();
    onClose();
  }
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copié"));

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
            <div className="mt-1 font-medium">{row.first_name} {row.last_name}</div>
            <div className="text-sm text-muted-foreground">{row.shop_name}{row.city ? ` — ${row.city}` : ""}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(row.email)}><Copy className="mr-1 h-3 w-3" /> {row.email}</Button>
              <Button asChild size="sm" variant="outline"><a href={`mailto:${row.email}`}><Mail className="mr-1 h-3 w-3" /> Mail</a></Button>
              <Button size="sm" variant="outline" onClick={() => copy(row.phone)}><Copy className="mr-1 h-3 w-3" /> {row.phone}</Button>
              <Button asChild size="sm" variant="outline"><a href={`tel:${row.phone}`}><Phone className="mr-1 h-3 w-3" /> Appeler</a></Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">L'envoi automatique n'est pas configuré. Utilisez la copie ou le lien e-mail.</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs uppercase text-muted-foreground">Établissements</div><div>{row.establishments_count ?? "—"}</div></div>
            <div><div className="text-xs uppercase text-muted-foreground">Créneau souhaité</div><div>{row.preferred_slot ?? "—"}</div></div>
          </div>

          {row.message && (
            <div>
              <div className="text-xs uppercase text-muted-foreground">Message</div>
              <p className="mt-1 whitespace-pre-wrap rounded-md border bg-secondary/30 p-3 text-sm">{row.message}</p>
            </div>
          )}

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
              <Input className="mt-1" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
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