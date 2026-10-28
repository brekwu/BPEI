import { createFileRoute, Link, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Inbox, Store, Globe2, Scale, PackageOpen, ShieldCheck, Handshake, ScrollText, FlaskConical, Bell, CreditCard, Gavel, Settings2, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({ meta: [{ title: "Console patron BPEI" }] }),
  beforeLoad: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_platform_roles").select("role").eq("user_id", uid);
    const roles = new Set((data ?? []).map((r) => r.role));
    if (!roles.has("owner_bpei")) throw redirect({ to: "/app" });
  },
  component: OwnerLayout,
});

type NavItem = { to: string; label: string; icon: typeof ClipboardList; exact?: boolean };
type NavSection = { title: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      { to: "/owner", label: "À traiter", icon: ClipboardList, exact: true },
      { to: "/owner/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Réseau",
    items: [
      { to: "/admin/interventions", label: "Interventions clients", icon: ClipboardList },
      { to: "/admin/techniciens", label: "Candidatures techniciens", icon: Inbox },
      { to: "/owner/candidatures", label: "Candidatures", icon: Inbox },
      { to: "/owner/boutiques", label: "Structures", icon: Store },
      { to: "/owner/verifications", label: "Vérifications", icon: ShieldCheck },
      { to: "/owner/publications", label: "Publications", icon: Globe2 },
      { to: "/owner/partenariats", label: "Partenariats", icon: Handshake },
    ],
  },
  {
    title: "Gestion",
    items: [
      { to: "/owner/paiements", label: "Paiements", icon: CreditCard },
      { to: "/owner/modules", label: "Modules", icon: PackageOpen },
      { to: "/owner/imports", label: "Assistance imports", icon: FileSpreadsheet },
      { to: "/owner/historique", label: "Historique", icon: ScrollText },
    ],
  },
  {
    title: "Juridique & sécurité",
    items: [
      { to: "/owner/juridique", label: "Dossiers vendeurs", icon: Scale },
      { to: "/owner/plateforme-legale", label: "Centre juridique", icon: ScrollText },
      { to: "/owner/legal", label: "Fondations juridiques", icon: Gavel },
    ],
  },
  {
    title: "Paramètres",
    items: [
      { to: "/owner/parametres-publics", label: "Site public", icon: Settings2 },
      { to: "/owner/tests", label: "Tests S5", icon: FlaskConical },
    ],
  },
];

function useUnreadCount() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { count } = await supabase
        .from("owner_notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (!cancelled) setN(count ?? 0);
    }
    load();
    const ch = supabase
      .channel("owner-notif-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "owner_notifications" }, load)
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);
  return n;
}

function OwnerLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unread = useUnreadCount();
  return (
    <AppShell title="Console patron" subtitle="Gestion du réseau BPEI">
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <Card className="p-2 h-fit md:sticky md:top-4">
          <nav className="flex flex-col gap-3">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </div>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((n) => {
                    const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
                    const Icon = n.icon;
                    const showBadge = n.to === "/owner/notifications" && unread > 0;
                    return (
                      <Link key={n.to} to={n.to}
                        className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors ${active ? "bg-navy text-navy-foreground font-medium" : "hover:bg-secondary text-foreground/80"}`}>
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1">{n.label}</span>
                        {showBadge && (
                          <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                            {unread > 99 ? "99+" : unread}
                          </Badge>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </Card>
        <div className="min-w-0"><Outlet /></div>
      </div>
    </AppShell>
  );
}