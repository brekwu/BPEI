import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, ShieldCheck, User, Wrench, ArrowRight } from "lucide-react";

const searchSchema = z.object({ invitation: z.string().optional() });

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Mon espace — BPEI" }] }),
  validateSearch: searchSchema,
  component: AppHome,
});

interface Membership {
  shop_id: string;
  role: string;
  shops: { name: string; city: string | null; status: string } | null;
}

interface OwnedShop {
  id: string;
  name: string;
  city: string | null;
  status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon", pending: "En attente", under_review: "En vérification",
  validated: "Validée", rejected: "Refusée", suspended: "Suspendue",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  validated: "default", pending: "secondary", under_review: "secondary",
  draft: "outline", rejected: "destructive", suspended: "destructive",
};

function AppHome() {
  const navigate = useNavigate();
  const { invitation } = Route.useSearch();
  const [isAdmin, setIsAdmin] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [ownedShops, setOwnedShops] = useState<OwnedShop[]>([]);
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      setEmail(userData.user?.email ?? "");
      if (!uid) return;

      if (invitation) {
        const { data: shopIdData, error } = await supabase.rpc("accept_shop_invitation", { _token: invitation });
        if (error) toast.error(error.message);
        else if (shopIdData) {
          toast.success("Invitation acceptée");
          navigate({ to: `/app/shop/${shopIdData}/dashboard`, replace: true });
          return;
        }
      }

      // Self-heal: attach this user to shops from their accepted applications
      // (handles cases where the account was created after the application was validated).
      await supabase.rpc("reconcile_my_shop_access");

      const [rolesRes, membRes, ownedRes] = await Promise.all([
        supabase.from("user_platform_roles").select("role").eq("user_id", uid),
        supabase.from("shop_memberships").select("shop_id, role, shops(name, city, status)").eq("user_id", uid),
        supabase.from("shops").select("id, name, city, status, created_at").eq("owner_user_id", uid).order("created_at", { ascending: false }),
      ]);

      const admin = (rolesRes.data ?? []).some((r) => r.role === "admin_bpei");
      const mems = (membRes.data ?? []) as Membership[];
      const owned = (ownedRes.data ?? []) as OwnedShop[];
      setIsAdmin(admin);
      setMemberships(mems);
      setOwnedShops(owned);
      setLoading(false);

      // Auto-redirect if user has exactly one accessible validated shop
      const accessible = new Map<string, string>();
      for (const o of owned) if (o.status === "validated") accessible.set(o.id, o.name);
      for (const m of mems) if (m.shops?.status === "validated") accessible.set(m.shop_id, m.shops.name);
      if (accessible.size === 1 && !admin) {
        const [only] = accessible.keys();
        navigate({ to: `/app/shop/${only}/dashboard`, replace: true });
      }
    })();
  }, [invitation, navigate]);

  return (
    <AppShell title="Mon espace" subtitle={email}>
      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {isAdmin && (
            <Card className="border-electric/30 bg-electric/5">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-electric text-electric-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Administration BPEI</CardTitle>
                  <p className="text-xs text-muted-foreground">Accès global à la plateforme</p>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-navy text-navy-foreground hover:bg-navy/90">
                  <Link to="/admin">Ouvrir la console admin</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-navy/5 text-navy">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Mes boutiques</CardTitle>
                <p className="text-xs text-muted-foreground">Boutiques que vous avez créées</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ownedShops.length === 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">Vous n'avez encore inscrit aucune boutique.</p>
                  <Button asChild variant="outline"><Link to="/rejoindre">Inscrire ma boutique</Link></Button>
                </>
              ) : (
                <ul className="space-y-2">
                  {ownedShops.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{s.name}</div>
                        {s.city && <div className="text-xs text-muted-foreground">{s.city}</div>}
                      </div>
                      <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                      {s.status === "validated" && (
                        <Button asChild size="sm" variant="outline"><Link to={`/app/shop/${s.id}/dashboard`}>Ouvrir<ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-navy/5 text-navy">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Mes affectations</CardTitle>
                <p className="text-xs text-muted-foreground">Boutiques où vous travaillez</p>
              </div>
            </CardHeader>
            <CardContent>
              {memberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune affectation. Un responsable de boutique peut vous inviter à rejoindre son équipe.
                </p>
              ) : (
                <ul className="space-y-2">
                  {memberships.map((m) => (
                    <li key={m.shop_id + m.role} className="flex items-center justify-between gap-2 rounded-md border border-border bg-background p-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{m.shops?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
                      </div>
                      {m.shops?.status === "validated" && (
                        <Button asChild size="sm" variant="outline"><Link to={`/app/shop/${m.shop_id}/dashboard`}>Ouvrir<ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-navy/5 text-navy">
                <User className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Espace client final</CardTitle>
                <p className="text-xs text-muted-foreground">Suivi de vos réparations</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Retrouvez vos rendez-vous, réparations, devis et factures rattachés à votre email.
              </p>
              <Button asChild variant="outline" className="w-full"><Link to="/portail">Ouvrir mon espace client</Link></Button>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}