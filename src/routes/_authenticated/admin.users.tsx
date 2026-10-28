import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { listPlatformUsers, setPlatformRole } from "@/lib/admin-platform.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Utilisateurs plateforme — BPEI" }] }),
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
  component: PlatformUsers,
});

interface Row {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  platform_roles: string[];
  shop_count: number;
}

function PlatformUsers() {
  const list = useServerFn(listPlatformUsers);
  const setRole = useServerFn(setPlatformRole);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [me, setMe] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await list();
      setRows(data as Row[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  async function toggle(userId: string, isAdmin: boolean) {
    setBusy(userId);
    try {
      await setRole({ data: { target_user_id: userId, role: "admin_bpei", grant: !isAdmin } });
      toast.success(isAdmin ? "Rôle retiré" : "Rôle admin_bpei accordé");
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q) || r.id.includes(q));
  }, [rows, filter]);

  return (
    <AppShell title="Utilisateurs plateforme" subtitle="Gestion des accès admin BPEI">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline"><Link to="/admin">← Console</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/admin/activity">Journal d'activité</Link></Button>
        <div className="ml-auto w-full max-w-xs">
          <Input placeholder="Rechercher email ou UUID" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{loading ? "Chargement…" : `${filtered.length} utilisateurs`}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Rôles</th>
                  <th className="py-3 pr-4">Boutiques</th>
                  <th className="py-3 pr-4">Créé</th>
                  <th className="py-3 pr-4">Dernière connexion</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u) => {
                  const isAdmin = u.platform_roles.includes("admin_bpei");
                  const isMe = u.id === me;
                  return (
                    <tr key={u.id}>
                      <td className="py-3 pr-4">
                        <div className="font-medium">{u.email || "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}…{isMe && " (vous)"}</div>
                      </td>
                      <td className="py-3 pr-4">
                        {isAdmin && <Badge>admin_bpei</Badge>}
                        {!u.confirmed && <Badge variant="secondary" className="ml-1">non confirmé</Badge>}
                      </td>
                      <td className="py-3 pr-4">{u.shop_count}</td>
                      <td className="py-3 pr-4 text-xs">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="py-3 pr-4 text-xs">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <Button
                          size="sm"
                          variant={isAdmin ? "destructive" : "default"}
                          disabled={busy === u.id || (isMe && isAdmin)}
                          onClick={() => toggle(u.id, isAdmin)}
                        >
                          {isAdmin ? "Retirer admin" : "Promouvoir admin"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Aucun utilisateur.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}