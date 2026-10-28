import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { listActivityLogs } from "@/lib/admin-platform.functions";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  head: () => ({ meta: [{ title: "Journal d'activité — BPEI" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_platform_roles")
      .select("role")
      .eq("user_id", u.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin_bpei")) {
      throw redirect({ to: "/app" });
    }
  },
  component: ActivityLog,
});

interface Row {
  id: string;
  shop_id: string | null;
  actor_user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action: string;
  metadata: any;
  created_at: string;
  shop_name: string | null;
  actor_email: string | null;
}

function ActivityLog() {
  const list = useServerFn(listActivityLogs);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  async function load() {
    setLoading(true);
    try {
      const payload: any = { limit: 200 };
      if (entityType.trim()) payload.entity_type = entityType.trim();
      if (action.trim()) payload.action = action.trim();
      const data = await list({ data: payload });
      setRows(data as Row[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <AppShell title="Journal d'activité" subtitle="Trace des actions plateforme (200 dernières)">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/admin">← Console</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/admin/users">Utilisateurs</Link></Button>
        <Input className="w-40" placeholder="Type entité" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        <Input className="w-40" placeholder="Action" value={action} onChange={(e) => setAction(e.target.value)} />
        <Button size="sm" onClick={load} disabled={loading}>Filtrer</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? "Chargement…" : `${rows.length} événements`}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Boutique</th>
                  <th className="py-2 pr-4">Acteur</th>
                  <th className="py-2 pr-4">Entité</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="py-2 pr-4 text-xs">{r.shop_name ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs">{r.actor_email ?? "—"}</td>
                    <td className="py-2 pr-4"><Badge variant="secondary">{r.entity_type ?? "—"}</Badge></td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.action}</td>
                    <td className="py-2 pr-4 text-xs text-muted-foreground max-w-md truncate">
                      {r.metadata ? JSON.stringify(r.metadata) : "—"}
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucun événement.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}