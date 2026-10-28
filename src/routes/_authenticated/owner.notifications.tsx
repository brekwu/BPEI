import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, ExternalLink, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Console patron" }] }),
  component: NotificationsPage,
});

type Notif = {
  id: string;
  category: string;
  severity: "info" | "warning" | "critical" | "success";
  title: string;
  body: string | null;
  link_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

const CATEGORIES = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "candidature", label: "Candidatures" },
  { key: "publication", label: "Publications" },
  { key: "juridique", label: "Juridique" },
  { key: "verification", label: "Vérifications" },
  { key: "partenariat", label: "Partenariats" },
];

const SEV_COLORS: Record<string, string> = {
  critical: "border-l-destructive bg-destructive/5",
  warning: "border-l-amber-500 bg-amber-500/5",
  info: "border-l-blue-500 bg-blue-500/5",
  success: "border-l-emerald-500 bg-emerald-500/5",
};

function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("unread");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("owner_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Notif[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("owner-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "owner_notifications" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function markOne(id: string) {
    const { error } = await supabase.rpc("mark_owner_notification_read", { _id: id });
    if (error) toast.error(error.message);
    else load();
  }

  async function markAll() {
    const { data, error } = await supabase.rpc("mark_all_owner_notifications_read");
    if (error) toast.error(error.message);
    else {
      toast.success(`${data ?? 0} notification(s) marquée(s) lue(s)`);
      load();
    }
  }

  const filtered = items.filter((n) => {
    if (tab === "all") return true;
    if (tab === "unread") return !n.read_at;
    return n.category === tab;
  });

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Centre de notifications</h2>
          {unread > 0 && <Badge variant="destructive">{unread} non lue{unread > 1 ? "s" : ""}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Rafraîchir
          </Button>
          <Button size="sm" onClick={markAll} disabled={unread === 0}>
            <CheckCheck className="h-4 w-4 mr-1" /> Tout marquer lu
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.key} value={c.key}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {loading && items.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">Chargement…</Card>
          ) : filtered.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              🎉 Aucune notification dans cette catégorie
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((n) => (
                <Card
                  key={n.id}
                  className={`p-3 border-l-4 ${SEV_COLORS[n.severity] ?? ""} ${n.read_at ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{n.title}</span>
                        <Badge variant="outline" className="text-xs">{n.category}</Badge>
                        {!n.read_at && <Badge variant="destructive" className="text-xs">Nouveau</Badge>}
                      </div>
                      {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {n.link_url && (
                        <Button variant="ghost" size="sm" onClick={() => navigate({ to: n.link_url! })}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {!n.read_at && (
                        <Button variant="ghost" size="sm" onClick={() => markOne(n.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}