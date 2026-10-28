import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Check,
  ChevronDown,
  Globe,
  LogOut,
  Shield,
  Store,
  User as UserIcon,
  Wrench,
} from "lucide-react";

interface Spaces {
  loading: boolean;
  email: string;
  hasClientPortal: boolean;
  isAdminBpei: boolean;
  isOwnerBpei: boolean;
  shops: Array<{ shopId: string; name: string; role: string }>;
}

export function useAvailableSpaces(): Spaces {
  const [state, setState] = useState<Spaces>({
    loading: true,
    email: "",
    hasClientPortal: false,
    isAdminBpei: false,
    isOwnerBpei: false,
    shops: [],
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
        return;
      }
      const [rolesRes, memRes, ownedRes, portalRes] = await Promise.all([
        supabase.from("user_platform_roles").select("role").eq("user_id", user.id),
        supabase
          .from("shop_memberships")
          .select("shop_id, role, shops(name, status)")
          .eq("user_id", user.id),
        supabase
          .from("shops")
          .select("id, name, status")
          .eq("owner_user_id", user.id),
        supabase.from("customer_portal_links").select("id", { count: "exact", head: true }),
      ]);
      const roles = new Set((rolesRes.data ?? []).map((r: any) => r.role));
      const shopsMap = new Map<string, { shopId: string; name: string; role: string }>();
      for (const o of ownedRes.data ?? []) {
        if ((o as any).status === "validated")
          shopsMap.set((o as any).id, { shopId: (o as any).id, name: (o as any).name, role: "owner" });
      }
      for (const m of (memRes.data ?? []) as any[]) {
        if (m.shops?.status === "validated" && !shopsMap.has(m.shop_id))
          shopsMap.set(m.shop_id, { shopId: m.shop_id, name: m.shops.name, role: m.role });
      }
      if (cancelled) return;
      setState({
        loading: false,
        email: user.email ?? "",
        hasClientPortal: (portalRes.count ?? 0) > 0,
        isAdminBpei: roles.has("admin_bpei"),
        isOwnerBpei: roles.has("owner_bpei"),
        shops: [...shopsMap.values()],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

interface Props {
  currentShopId?: string;
  variant?: "light" | "dark";
  align?: "start" | "center" | "end";
}

export function SpaceSwitcher({ currentShopId, variant = "light", align = "end" }: Props) {
  const spaces = useAvailableSpaces();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const onPublic = !pathname.startsWith("/app") && !pathname.startsWith("/admin") && !pathname.startsWith("/owner") && !pathname.startsWith("/portail");
  const onPortail = pathname.startsWith("/portail");
  const onAdmin = pathname.startsWith("/admin");
  const onOwner = pathname.startsWith("/owner");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function switchShop(shopId: string) {
    if (shopId !== currentShopId) {
      await qc.cancelQueries();
      qc.clear();
    }
    navigate({ to: `/app/shop/${shopId}/dashboard` });
  }

  const label = spaces.loading
    ? "Mon compte"
    : onPortail
    ? "Espace client"
    : onAdmin
    ? "Administration"
    : onOwner
    ? "Console patron"
    : onPublic
    ? "Mon compte"
    : (spaces.shops.find((s) => s.shopId === currentShopId)?.name ?? "Espace boutique");

  const btnClass = variant === "dark"
    ? "text-white hover:bg-white/10 border border-white/20"
    : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={btnClass} aria-label="Changer d'espace">
          <UserIcon className="mr-2 h-4 w-4" />
          <span className="max-w-[160px] truncate">{label}</span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        {spaces.email && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground truncate">
              {spaces.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel>Changer d'espace</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/" className="cursor-pointer">
              <Globe className="mr-2 h-4 w-4" />
              <span className="flex-1">Voir le site public</span>
              {onPublic && <Check className="h-4 w-4" />}
            </Link>
          </DropdownMenuItem>

          {spaces.hasClientPortal && (
            <DropdownMenuItem asChild>
              <Link to="/portail" className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                <span className="flex-1">Espace client</span>
                {onPortail && <Check className="h-4 w-4" />}
              </Link>
            </DropdownMenuItem>
          )}

          {spaces.isAdminBpei && (
            <DropdownMenuItem asChild>
              <Link to="/admin" className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                <span className="flex-1">Administration BPEI</span>
                {onAdmin && <Check className="h-4 w-4" />}
              </Link>
            </DropdownMenuItem>
          )}

          {spaces.isOwnerBpei && (
            <DropdownMenuItem asChild>
              <Link to="/owner" className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                <span className="flex-1">Console patron</span>
                {onOwner && <Check className="h-4 w-4" />}
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        {spaces.shops.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {spaces.shops.length > 1 ? "Mes boutiques" : "Espace boutique"}
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {spaces.shops.map((s) => {
                const active = s.shopId === currentShopId;
                return (
                  <DropdownMenuItem
                    key={s.shopId}
                    onClick={() => switchShop(s.shopId)}
                    className="cursor-pointer"
                  >
                    <Store className="mr-2 h-4 w-4" />
                    <span className="flex-1 truncate">{s.name}</span>
                    {active && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PublicSiteButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  return (
    <Button asChild variant={variant} size="sm" aria-label="Voir le site public">
      <Link to="/">
        <Globe className="mr-2 h-4 w-4" />
        Voir le site public
      </Link>
    </Button>
  );
}

export { Wrench as _WrenchIcon };