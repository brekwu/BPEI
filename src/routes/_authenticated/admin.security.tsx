import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, ShieldAlert, ShieldOff, RefreshCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Sécurité — BPEI Admin" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_platform_roles").select("role").eq("user_id", u.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin_bpei")) throw redirect({ to: "/app" });
  },
  component: AdminSecurity,
});

interface AbuseRow {
  id: string; occurred_at: string; ip: string | null; ip_hash: string;
  fingerprint: string | null; shop_id: string | null; endpoint: string;
  event_type: string; severity: string; user_agent: string | null;
  metadata: Record<string, unknown>;
}
interface BlockRow {
  id: string; ip_hash: string; ip: string | null; reason: string;
  blocked_until: string; created_at: string;
}

const SEV_COLOR: Record<string, "default"|"secondary"|"destructive"> = {
  info: "secondary", warn: "default", critical: "destructive",
};

function AdminSecurity() {
  const [events, setEvents] = useState<AbuseRow[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEndpoint, setFilterEndpoint] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [eRes, bRes] = await Promise.all([
      supabase.rpc("admin_list_abuse", { _limit: 500 }),
      supabase.rpc("admin_list_active_blocks"),
    ]);
    if (eRes.error) toast.error(eRes.error.message);
    if (bRes.error) toast.error(bRes.error.message);
    setEvents((eRes.data ?? []) as AbuseRow[]);
    setBlocks((bRes.data ?? []) as BlockRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function block(row: AbuseRow) {
    const { error } = await supabase.rpc("admin_block_ip", {
      _ip_hash: row.ip_hash, _ip: row.ip ?? "", _minutes: 24 * 60, _reason: `manuel via ${row.endpoint}`,
    });
    if (error) return toast.error(error.message);
    toast.success("IP bloquée 24h");
    load();
  }
  async function unblock(row: BlockRow) {
    const { error } = await supabase.rpc("admin_unblock_ip", { _ip_hash: row.ip_hash });
    if (error) return toast.error(error.message);
    toast.success("Blocage levé");
    load();
  }

  const filtered = events.filter((e) =>
    (!filterEndpoint || e.endpoint.includes(filterEndpoint)) &&
    (!filterSeverity || e.severity === filterSeverity)
  );
  const stats = {
    total: events.length,
    warn: events.filter((e) => e.severity === "warn").length,
    critical: events.filter((e) => e.severity === "critical").length,
    blocks: blocks.length,
  };

  return (
    <AppShell title="Sécurité & anti-abus" subtitle="Journal des événements suspects et blocages IP">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/admin" className="text-xs text-electric hover:underline">← Retour à l'admin</Link>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-1.5" />Actualiser
        </Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {[
          { label: "Événements (500 max)", value: stats.total, icon: Shield },
          { label: "Avertissements", value: stats.warn, icon: ShieldAlert },
          { label: "Critiques", value: stats.critical, icon: ShieldAlert },
          { label: "IP bloquées", value: stats.blocks, icon: ShieldOff },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-navy">{s.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
                </div>
                <s.icon className="h-8 w-8 text-electric/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader><CardTitle>Blocages IP actifs</CardTitle></CardHeader>
        <CardContent>
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune IP bloquée actuellement.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="py-2 pr-4">IP</th><th className="py-2 pr-4">Raison</th><th className="py-2 pr-4">Jusqu'à</th><th className="py-2 pr-4"></th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {blocks.map((b) => (
                    <tr key={b.id}>
                      <td className="py-2 pr-4 font-mono text-xs">{b.ip ?? b.ip_hash.slice(0, 12) + "…"}</td>
                      <td className="py-2 pr-4">{b.reason}</td>
                      <td className="py-2 pr-4">{new Date(b.blocked_until).toLocaleString("fr-FR")}</td>
                      <td className="py-2 pr-4"><Button size="sm" variant="outline" onClick={() => unblock(b)}>Débloquer</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journal d'abus</CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input placeholder="Filtrer par endpoint…" className="max-w-xs" value={filterEndpoint} onChange={(e) => setFilterEndpoint(e.target.value)} />
            <select className="border border-input bg-background rounded-md px-3 py-2 text-sm" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
              <option value="">Toutes gravités</option>
              <option value="info">Info</option>
              <option value="warn">Avertissement</option>
              <option value="critical">Critique</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun événement.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">IP</th>
                    <th className="py-2 pr-3">Endpoint</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Gravité</th>
                    <th className="py-2 pr-3">Détails</th>
                    <th className="py-2 pr-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 pr-3 text-xs whitespace-nowrap">{new Date(e.occurred_at).toLocaleString("fr-FR")}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{e.ip ?? e.ip_hash.slice(0, 10) + "…"}</td>
                      <td className="py-2 pr-3 text-xs">{e.endpoint}</td>
                      <td className="py-2 pr-3 text-xs">{e.event_type}</td>
                      <td className="py-2 pr-3"><Badge variant={SEV_COLOR[e.severity] ?? "secondary"}>{e.severity}</Badge></td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground max-w-xs truncate" title={JSON.stringify(e.metadata)}>{JSON.stringify(e.metadata)}</td>
                      <td className="py-2 pr-3">
                        <Button size="sm" variant="ghost" onClick={() => block(e)}>Bloquer 24h</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}