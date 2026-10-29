import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BPEILogo } from "@/components/BPEILogo";
import { cn } from "@/lib/utils";
import { SHOP_ROLE_LABEL, type ShopRole } from "@/lib/shop-constants";
import {
  LayoutDashboard, Wrench, Users, Cpu, UsersRound, Settings,
  Calendar, FileText, Receipt, Package, Truck, BarChart3, LogOut,
  ChevronsLeft, ChevronsRight, Menu, X, Store, HelpCircle, Search,
  CreditCard, Undo2, Star, HeartPulse, Boxes, ShoppingBag, Bell, History,
  ScanLine, Banknote, Sparkles,
} from "lucide-react";
import { GlobalSearch, useGlobalSearchHotkey } from "@/components/shop/GlobalSearch";
import { SpaceSwitcher, PublicSiteButton } from "@/components/SpaceSwitcher";


export type EffectiveRole = ShopRole | "owner" | "admin_bpei";

export interface ShopContextValue {
  shopId: string;
  shopName: string;
  role: EffectiveRole;
  subscription?: {
    effective_status: string;
    ends_at: string | null;
    days_remaining: number | null;
    plan: string;
    status: string;
  } | null;
  businessType?: string | null;
  verificationStatus?: string | null;
}

const ShopCtx = createContext<ShopContextValue | null>(null);
export function useShop(): ShopContextValue {
  const v = useContext(ShopCtx);
  if (!v) throw new Error("useShop must be used inside ShopLayout");
  return v;
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const SIDEBAR_KEY = "bpei:sidebar-collapsed";

export function ShopLayout({ ctx, children }: { ctx: ShopContextValue; children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useGlobalSearchHotkey(setSearchOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const base = `/app/shop/${ctx.shopId}`;
  const groups: NavGroup[] = [
    {
      label: "Vue d'ensemble",
      items: [{ to: `${base}/dashboard`, label: "Tableau de bord", icon: LayoutDashboard }],
    },
    {
      label: "Activité",
      items: [
        { to: `${base}/checkout`, label: "Encaissement", icon: ScanLine },
        { to: `${base}/cash-register`, label: "Caisse", icon: Banknote },
        { to: `${base}/repairs`, label: "Réparations", icon: Wrench },
        { to: `${base}/appointments`, label: "Rendez-vous", icon: Calendar },
        { to: `${base}/orders`, label: "Commandes", icon: ShoppingBag },
        { to: `${base}/reviews`, label: "Avis clients", icon: Star },
      ],
    },
    {
      label: "Gestion",
      items: [
        { to: `${base}/clients`, label: "Clients", icon: Users },
        { to: `${base}/devices`, label: "Appareils", icon: Cpu },
        { to: `${base}/catalog`, label: "Catalogue", icon: Package },
        { to: `${base}/stock`, label: "Stock", icon: Boxes },
      ],
    },
    {
      label: "Finance",
      items: [
        { to: `${base}/quotes`, label: "Devis", icon: FileText },
        { to: `${base}/invoices`, label: "Factures", icon: Receipt },
        { to: `${base}/payments`, label: "Paiements", icon: CreditCard },
        { to: `${base}/payments/links`, label: "Liens de paiement", icon: CreditCard },
        { to: `${base}/payments/stripe`, label: "Stripe Connect", icon: CreditCard },
        { to: `${base}/credit-notes`, label: "Avoirs", icon: Undo2 },
        { to: `${base}/finance`, label: "Analyse", icon: BarChart3 },
      ],
    },
    {
      label: "Équipe",
      items: [
        { to: `${base}/team`, label: "Membres", icon: UsersRound },
        { to: `${base}/notifications`, label: "Notifications", icon: Bell },
        { to: `${base}/activity`, label: "Historique", icon: History },
      ],
    },
    ...(() => {
      const plan = String(ctx.subscription?.plan ?? "");
      const bt = String(ctx.businessType ?? "");
      const shopSideCapable = ["shop_pro","shop_network","pro","network"].includes(plan)
        && ["physical_shop","hybrid_business","multi_location_network"].includes(bt);
      const indepSideCapable = plan === "independent_partner"
        && ["mobile_independent","hybrid_business"].includes(bt);
      const items: NavItem[] = [];
      if (shopSideCapable) items.push({ to: `${base}/partners`, label: "Partenariats", icon: HeartPulse });
      if (indepSideCapable) items.push({ to: `${base}/network`, label: "Opportunités réseau", icon: Star });
      if (!shopSideCapable && !indepSideCapable) {
        items.push({ to: `${base}/partners`, label: "Découvrir le réseau", icon: HeartPulse });
      }
      return [{ label: "Réseau BPEI", items }] satisfies NavGroup[];
    })(),
    {
      label: "Outils",
      items: [
        { to: `${base}/imports`, label: "Import intelligent (beta)", icon: Sparkles },
      ],
    },
    {
      label: "Paramètres",
      items: [
        { to: `${base}/settings`, label: "Boutique", icon: Settings },
        { to: `${base}/purchasing`, label: "Fournisseurs", icon: Truck },
        { to: `${base}/health`, label: "Diagnostic", icon: HeartPulse },
      ],
    },

  ];

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const roleLabel =
    ctx.role === "admin_bpei" ? "Administrateur BPEI"
    : ctx.role === "owner" ? "Propriétaire"
    : SHOP_ROLE_LABEL[ctx.role];

  const initials = ctx.shopName
    .split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "BP";

  return (
    <ShopCtx.Provider value={ctx}>
      <div className="flex min-h-dvh bg-surface-muted">
        {/* Mobile overlay */}
        {mobileOpen && (
          <button
            aria-label="Fermer le menu"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm md:hidden"
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-[width,transform] duration-200 ease-out",
            "md:sticky md:top-0 md:h-dvh md:translate-x-0",
            collapsed ? "md:w-[76px]" : "md:w-[264px]",
            mobileOpen ? "w-[280px] translate-x-0" : "w-[280px] -translate-x-full",
          )}
        >
          <div className={cn("flex h-16 items-center gap-2 border-b border-border px-4", collapsed && "md:justify-center md:px-2")}>
            <Link to="/app" className="flex items-center gap-2 min-w-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy text-navy-foreground shadow-sm">
                <span className="font-display text-sm font-bold">B</span>
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold leading-tight text-navy">BPEI</div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Console pro</div>
                </div>
              )}
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-secondary md:hidden"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Shop card */}
          <div className={cn("px-3 py-3", collapsed && "md:px-2")}>
            <div className={cn(
              "flex items-center gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2.5",
              collapsed && "md:justify-center md:px-0 md:py-2 md:border-0 md:bg-transparent",
            )}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-electric-soft font-display text-sm font-bold text-electric">
                {initials}
              </div>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{ctx.shopName}</div>
                  <div className="truncate text-xs text-muted-foreground">{roleLabel}</div>
                </div>
              )}
            </div>
          </div>

          <nav className={cn("flex-1 overflow-y-auto px-3 pb-3", collapsed && "md:px-2")}>
            {groups.map((g) => (
              <div key={g.label} className="mb-4">
                {!collapsed && (
                  <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                    {g.label}
                  </div>
                )}
                <ul className="space-y-0.5">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    const active = !it.soon && pathname.startsWith(it.to);
                    if (it.soon) {
                      return (
                        <li key={it.label}>
                          <div
                            title={it.label}
                            className={cn(
                              "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-muted-foreground/60",
                              collapsed && "md:justify-center md:px-0",
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <>
                                <span className="flex-1 truncate">{it.label}</span>
                                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                  Bientôt
                                </span>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    }
                    return (
                      <li key={it.to}>
                        <Link
                          to={it.to}
                          title={collapsed ? it.label : undefined}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-all",
                            active
                              ? "bg-navy text-navy-foreground shadow-sm"
                              : "text-anthracite hover:bg-secondary hover:text-navy",
                            collapsed && "md:justify-center md:px-0",
                          )}
                        >
                          {active && (
                            <span className="absolute left-0 top-1/2 hidden h-5 w-0.5 -translate-x-3 -translate-y-1/2 rounded-r-full bg-electric md:block" />
                          )}
                          <Icon className={cn("h-4 w-4 shrink-0", active && "text-electric")} />
                          {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className={cn("border-t border-border px-3 py-3", collapsed && "md:px-2")}>
            <button
              onClick={signOut}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-anthracite transition-colors hover:bg-destructive/10 hover:text-destructive",
                collapsed && "md:justify-center md:px-0",
              )}
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Déconnexion</span>}
            </button>
          </div>

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden items-center justify-center border-t border-border py-2 text-muted-foreground hover:bg-secondary hover:text-navy md:flex"
            aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </aside>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur">
            <div className="flex h-16 items-center gap-3 px-4 md:px-6">
              <button
                onClick={() => setMobileOpen(true)}
                className="rounded-md border border-border p-2 text-muted-foreground hover:bg-secondary hover:text-navy md:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-4 w-4" />
              </button>

              <div className="hidden md:block">
                <BPEILogo variant="dark" />
              </div>

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="ml-2 hidden max-w-sm flex-1 items-center gap-2 rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-navy/30 hover:text-navy md:flex"
                aria-label="Recherche globale"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="truncate">Rechercher…</span>
                <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
              </button>

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="rounded-md border border-border p-2 text-muted-foreground hover:bg-secondary hover:text-navy md:hidden"
                aria-label="Recherche"
              >
                <Search className="h-4 w-4" />
              </button>


              <div className="ml-auto flex items-center gap-1.5">
                <PublicSiteButton />
                <SpaceSwitcher currentShopId={ctx.shopId} />
                <Button variant="ghost" size="icon" aria-label="Aide" className="hidden sm:inline-flex">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
              <BetaExpirationBanner sub={ctx.subscription} />
              {children}
            </div>
          </main>
        </div>
      </div>
      <GlobalSearch shopId={ctx.shopId} open={searchOpen} onOpenChange={setSearchOpen} />
    </ShopCtx.Provider>
  );
}

function BetaExpirationBanner({ sub }: { sub: ShopContextValue["subscription"] }) {
  if (!sub || sub.effective_status !== "trial" && sub.effective_status !== "active") return null;
  const days = sub.days_remaining;
  if (days == null || days > 30) return null;
  const dateLabel = sub.ends_at ? new Date(sub.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";
  const urgent = days <= 7;
  return (
    <div className={`mb-4 rounded-lg border p-3 text-sm ${urgent ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
      <strong>
        {days === 0 ? "Votre accès à BPEI Pro se termine aujourd'hui." :
         days === 1 ? "Votre accès à BPEI Pro se termine demain." :
         `Votre accès gratuit à BPEI Pro se termine dans ${days} jours (${dateLabel}).`}
      </strong>
      {" "}La formule Pro sera ensuite proposée à 150 € HT/mois. Aucun prélèvement automatique.
      {" "}<Link to="/contact" className="underline font-medium">Nous contacter</Link>.
    </div>
  );
}