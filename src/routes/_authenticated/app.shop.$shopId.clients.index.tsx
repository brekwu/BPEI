import { createFileRoute, Link } from "@tanstack/react-router";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import {
  PageContainer, PageHeader, DataTableShell, EmptyState,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Users } from "lucide-react";
import { customerDisplayName, CUSTOMER_TYPE_LABEL, type CustomerType } from "@/lib/shop-constants";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/clients/")({
  head: () => ({ meta: [{ title: "Clients — BPEI" }] }),
  component: ClientsList,
});

function ClientsList() {
  const { shopId } = useShop();
  const base = `/app/shop/${shopId}`;
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [type, setType] = useState<"all" | CustomerType>("all");
  const [archived, setArchived] = useState<"active" | "archived">("active");

  const { data, isLoading } = useQuery({
    queryKey: ["customers", shopId, dq, type, archived],
    queryFn: async () => {
      let query = supabase.from("customers")
        .select("id, customer_type, company_name, first_name, last_name, email, phone, city, created_at, archived_at")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(200);
      query = archived === "active" ? query.is("archived_at", null) : query.not("archived_at", "is", null);
      if (type !== "all") query = query.eq("customer_type", type);
      if (dq.trim()) {
        const t = `%${dq.trim()}%`;
        query = query.or(`company_name.ilike.${t},first_name.ilike.${t},last_name.ilike.${t},email.ilike.${t},phone.ilike.${t}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = data ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Boutique"
        title="Clients"
        description="Gérez vos clients particuliers et professionnels."
        actions={
          <Button asChild>
            <Link to={`${base}/clients/new`}><Plus className="mr-2 h-4 w-4" />Ajouter un client</Link>
          </Button>
        }
      />

      <DataTableShell
        toolbar={
          <>
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher nom, e-mail, téléphone…" className="pl-9" aria-label="Rechercher un client" />
            </div>
            <Tabs value={type} onValueChange={(v) => setType(v as typeof type)}>
              <TabsList>
                <TabsTrigger value="all">Tous</TabsTrigger>
                <TabsTrigger value="individual">Particuliers</TabsTrigger>
                <TabsTrigger value="business">Professionnels</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={archived} onValueChange={(v) => setArchived(v as typeof archived)}>
              <TabsList>
                <TabsTrigger value="active">Actifs</TabsTrigger>
                <TabsTrigger value="archived">Archivés</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        }
        loading={isLoading}
        empty={rows.length === 0}
        emptyIcon={<Users className="h-5 w-5" />}
        emptyTitle="Aucun client"
        emptyDescription="Créez votre premier client pour démarrer un dossier."
        emptyAction={
          <Button asChild>
            <Link to={`${base}/clients/new`}><Plus className="mr-2 h-4 w-4" />Ajouter un client</Link>
          </Button>
        }
      >
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                to={`${base}/clients/${c.id}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{customerDisplayName(c)}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[c.email, c.phone, c.city].filter(Boolean).join(" · ") || "Aucun contact renseigné"}
                  </div>
                </div>
                <Badge variant="outline" className="font-normal">{CUSTOMER_TYPE_LABEL[c.customer_type]}</Badge>
                {c.archived_at && <Badge variant="outline" className="font-normal text-muted-foreground">Archivé</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      </DataTableShell>
    </PageContainer>
  );
}