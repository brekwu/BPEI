import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/bug-reports")({
  head: () => ({ meta: [{ title: "Signalements — Administration BPEI" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_platform_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin_bpei")) throw redirect({ to: "/app" });
  },
  component: BugReportsPage,
});

type Report = {
  id: string;
  category: string;
  severity: string;
  status: "new" | "in_progress" | "resolved" | "wont_fix";
  title: string;
  description: string;
  page_url: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
  user_agent: string | null;
  admin_notes: string | null;
  created_at: string;
};

const SEV_COLOR: Record<string, string> = {
  low: "bg-slate-200 text-slate-700",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};
const STATUS_LABEL: Record<Report["status"], string> = {
  new: "Nouveau",
  in_progress: "En cours",
  resolved: "Résolu",
  wont_fix: "Non retenu",
};

function BugReportsPage() {
  const [items, setItems] = useState<Report[]>([]);
  const [filter, setFilter] = useState<"all" | Report["status"]>("all");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const q = supabase.from("bug_reports").select("*").order("created_at", { ascending: false }).limit(200);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setItems((data ?? []) as Report[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const visible = filter === "all" ? items : items.filter((r) => r.status === filter);
  const counts = {
    all: items.length,
    new: items.filter((r) => r.status === "new").length,
    in_progress: items.filter((r) => r.status === "in_progress").length,
    resolved: items.filter((r) => r.status === "resolved").length,
    wont_fix: items.filter((r) => r.status === "wont_fix").length,
  };

  async function updateStatus(id: string, status: Report["status"], notes?: string) {
    const patch: {
      status: Report["status"];
      admin_notes?: string | null;
      resolved_at?: string | null;
    } = { status };
    if (notes !== undefined) patch.admin_notes = notes;
    if (status === "resolved" || status === "wont_fix") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("bug_reports").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Mis à jour");
    load();
  }

  return (
    <AppShell title="Signalements & retours" subtitle="Bugs, idées et retours utilisateurs">
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/admin">← Console admin</Link></Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "new", "in_progress", "resolved", "wont_fix"] as const).map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>
            {k === "all" ? "Tous" : STATUS_LABEL[k]} ({counts[k]})
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{visible.length} signalement{visible.length > 1 ? "s" : ""}</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun signalement.</p>
          ) : (
            <div className="space-y-3">
              {visible.map((r) => (
                <div key={r.id} className="rounded-lg border border-border">
                  <button
                    className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-muted/40"
                    onClick={() => setOpenId(openId === r.id ? null : r.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${SEV_COLOR[r.severity] ?? ""}`}>{r.severity}</span>
                        <Badge variant="outline">{r.category}</Badge>
                        <Badge>{STATUS_LABEL[r.status]}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-FR")}</span>
                      </div>
                      <div className="mt-1 font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.reporter_name || "Anonyme"}{r.reporter_email ? ` · ${r.reporter_email}` : ""}
                        {r.page_url ? ` · ${r.page_url}` : ""}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{openId === r.id ? "▲" : "▼"}</span>
                  </button>
                  {openId === r.id && (
                    <div className="space-y-4 border-t border-border p-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{r.description}</p>
                      </div>
                      {r.user_agent && (
                        <div className="text-xs text-muted-foreground"><b>User-agent :</b> {r.user_agent}</div>
                      )}
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes internes</div>
                        <Textarea
                          defaultValue={r.admin_notes ?? ""}
                          rows={3}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val !== (r.admin_notes ?? "")) updateStatus(r.id, r.status, val);
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.status !== "new" && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "new")}>Rouvrir</Button>}
                        {r.status !== "in_progress" && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "in_progress")}>Prendre en charge</Button>}
                        {r.status !== "resolved" && <Button size="sm" onClick={() => updateStatus(r.id, "resolved")}>Marquer résolu</Button>}
                        {r.status !== "wont_fix" && <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "wont_fix")}>Non retenu</Button>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}