import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Administration — BPEI" }] }),
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
  component: AdminConsole,
});

interface Shop {
  id: string;
  name: string;
  legal_name: string | null;
  city: string | null;
  siret: string | null;
  email: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  pending: "En attente",
  under_review: "En vérification",
  validated: "Validée",
  rejected: "Refusée",
  suspended: "Suspendue",
};

interface Application {
  id: string;
  reference: string;
  status: string;
  contact_first_name: string;
  contact_last_name: string;
  contact_email: string;
  contact_phone: string | null;
  commercial_name: string;
  city: string | null;
  siret: string | null;
  created_at: string;
}

const APP_STATUS_LABEL: Record<string, string> = {
  nouvelle: "Nouvelle",
  verification: "Vérification",
  info_manquante: "Info manquante",
  validee: "Validée",
  refusee: "Refusée",
  invitation_envoyee: "Invitation envoyée",
  acces_active: "Accès actif",
  archivee: "Archivée",
};

function AdminConsole() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [globals, setGlobals] = useState({ contacts: 0, demos: 0, bugs: 0 });

  async function load() {
    setLoading(true);
    const [shopsRes, appsRes, contactsRes, demosRes, bugsRes] = await Promise.all([
      supabase
        .from("shops")
        .select("id, name, legal_name, city, siret, email, status, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("shop_applications")
        .select("id, reference, status, contact_first_name, contact_last_name, contact_email, contact_phone, commercial_name, city, siret, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("contact_submissions").select("id", { count: "exact", head: true }).eq("status", "nouvelle"),
      supabase.from("demo_requests").select("id", { count: "exact", head: true }).eq("status", "nouvelle"),
      supabase.from("bug_reports").select("id", { count: "exact", head: true }).in("status", ["new", "in_progress"]),
    ]);
    if (shopsRes.error) toast.error(shopsRes.error.message);
    if (appsRes.error) toast.error(appsRes.error.message);
    setShops((shopsRes.data ?? []) as Shop[]);
    setApplications((appsRes.data ?? []) as Application[]);
    setGlobals({
      contacts: contactsRes.count ?? 0,
      demos: demosRes.count ?? 0,
      bugs: bugsRes.count ?? 0,
    });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: Shop["status"] | "validated" | "under_review" | "rejected" | "suspended" | "pending") {
    const patch = {
      status: status as "validated",
      ...(status === "validated" ? { validated_at: new Date().toISOString() } : {}),
    };
    const { error } = await supabase.from("shops").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour");
    load();
  }

  const stats = {
    total: shops.length,
    pending: shops.filter((s) => s.status === "pending" || s.status === "under_review").length,
    validated: shops.filter((s) => s.status === "validated").length,
    suspended: shops.filter((s) => s.status === "suspended" || s.status === "rejected").length,
  };

  async function seedDemoShop() {
    if (!confirm("Créer une boutique de démonstration (InfoRepair Démo) rattachée à votre compte ?")) return;
    const { data, error } = await supabase.rpc("admin_seed_demo_shop");
    if (error) return toast.error(error.message);
    toast.success("Boutique démo créée");
    if (data) window.location.href = `/app/shop/${data as string}/dashboard`;
    else load();
  }


  return (
    <AppShell title="Administration BPEI" subtitle="Console globale">
      <div className="mb-6 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="default">
          <Link to="/owner">Candidatures boutiques (Console patron)</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/interventions">Demandes d’intervention</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/techniciens">Candidatures techniciens</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/contacts">
            Demandes de contact{globals.contacts > 0 && <Badge className="ml-2" variant="secondary">{globals.contacts}</Badge>}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/demo-requests">
            Demandes de démonstration{globals.demos > 0 && <Badge className="ml-2" variant="secondary">{globals.demos}</Badge>}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/bug-reports">
            Signalements & retours{globals.bugs > 0 && <Badge className="ml-2" variant="secondary">{globals.bugs}</Badge>}
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/security">Sécurité & anti-abus</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/users">Utilisateurs plateforme</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/activity">Journal d'activité</Link>
        </Button>
        <Button size="sm" variant="secondary" onClick={seedDemoShop}>
          Créer une boutique démo
        </Button>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[
          { label: "Boutiques", value: stats.total },
          { label: "En attente", value: stats.pending },
          { label: "Validées", value: stats.validated },
          { label: "Refusées / suspendues", value: stats.suspended },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-navy">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Candidatures reçues ({applications.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune candidature reçue.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4">Référence</th>
                    <th className="py-3 pr-4">Boutique</th>
                    <th className="py-3 pr-4">Contact</th>
                    <th className="py-3 pr-4">Email</th>
                    <th className="py-3 pr-4">Ville</th>
                    <th className="py-3 pr-4">Reçue le</th>
                    <th className="py-3 pr-4">Statut</th>
                    <th className="py-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {applications.map((a) => (
                    <tr key={a.id}>
                      <td className="py-3 pr-4 font-mono text-xs">{a.reference}</td>
                      <td className="py-3 pr-4 font-medium">{a.commercial_name}</td>
                      <td className="py-3 pr-4">{a.contact_first_name} {a.contact_last_name}</td>
                      <td className="py-3 pr-4">{a.contact_email}</td>
                      <td className="py-3 pr-4">{a.city ?? "—"}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("fr-FR")}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={a.status === "nouvelle" ? "default" : a.status === "refusee" ? "destructive" : "secondary"}>
                          {APP_STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/owner">Traiter</Link>
                        </Button>
                      </td>
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
          <CardTitle>Boutiques inscrites</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : shops.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune boutique inscrite pour l'instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="py-3 pr-4">Nom</th>
                    <th className="py-3 pr-4">Ville</th>
                    <th className="py-3 pr-4">SIRET</th>
                    <th className="py-3 pr-4">Statut</th>
                    <th className="py-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shops.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3 pr-4">
                        <div className="font-medium">{s.name}</div>
                        {s.legal_name && <div className="text-xs text-muted-foreground">{s.legal_name}</div>}
                      </td>
                      <td className="py-3 pr-4">{s.city ?? "—"}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{s.siret ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={s.status === "validated" ? "default" : s.status === "rejected" || s.status === "suspended" ? "destructive" : "secondary"}>
                          {STATUS_LABEL[s.status] ?? s.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          {s.status !== "validated" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "validated")}>
                              Valider
                            </Button>
                          )}
                          {s.status !== "under_review" && s.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "under_review")}>
                              En vérification
                            </Button>
                          )}
                          {s.status !== "rejected" && s.status !== "validated" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "rejected")}>
                              Refuser
                            </Button>
                          )}
                          {s.status === "validated" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "suspended")}>
                              Suspendre
                            </Button>
                          )}
                          {s.status === "suspended" && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(s.id, "validated")}>
                              Réactiver
                            </Button>
                          )}
                        </div>
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