import { createFileRoute, Link } from "@tanstack/react-router";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import {
  PageContainer, PageHeader, DataTableShell,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Smartphone } from "lucide-react";
import { DEVICE_TYPE_LABEL, customerDisplayName, type DeviceType } from "@/lib/shop-constants";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/devices/")({
  head: () => ({ meta: [{ title: "Appareils — BPEI" }] }),
  component: DevicesList,
});

function DevicesList() {
  const { shopId } = useShop();
  const base = `/app/shop/${shopId}`;
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [type, setType] = useState<"all" | DeviceType>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["devices", shopId, dq, type],
    queryFn: async () => {
      let query = supabase.from("devices")
        .select("id, device_type, brand, model, serial_number, warranty_end_date, archived_at, customers(customer_type, company_name, first_name, last_name)")
        .eq("shop_id", shopId).is("archived_at", null)
        .order("created_at", { ascending: false }).limit(200);
      if (type !== "all") query = query.eq("device_type", type);
      if (dq.trim()) {
        const t = `%${dq.trim()}%`;
        query = query.or(`brand.ilike.${t},model.ilike.${t},serial_number.ilike.${t},imei.ilike.${t}`);
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
        title="Appareils"
        description="Parc d'appareils confiés à la boutique."
        actions={
          <Button asChild>
            <Link to="/app/shop/$shopId/devices/new" params={{ shopId }}><Plus className="mr-2 h-4 w-4" />Ajouter un appareil</Link>
          </Button>
        }
      />

      <DataTableShell
        toolbar={
          <>
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Marque, modèle, n° série, IMEI…" className="pl-9" aria-label="Rechercher un appareil" />
            </div>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {Object.entries(DEVICE_TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        loading={isLoading}
        empty={rows.length === 0}
        emptyIcon={<Smartphone className="h-5 w-5" />}
        emptyTitle="Aucun appareil"
        emptyDescription="Ajoutez un appareil pour démarrer une réparation."
        emptyAction={
          <Button asChild>
            <Link to="/app/shop/$shopId/devices/new" params={{ shopId }}><Plus className="mr-2 h-4 w-4" />Ajouter un appareil</Link>
          </Button>
        }
      >
        <ul className="divide-y divide-border">
          {rows.map((d) => (
            <li key={d.id}>
              <Link
                to="/app/shop/$shopId/devices/$deviceId" params={{ shopId, deviceId: d.id }}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none"
              >
                <Badge variant="outline" className="font-normal">{DEVICE_TYPE_LABEL[d.device_type]}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{[d.brand, d.model].filter(Boolean).join(" ") || "Appareil"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {d.customers ? customerDisplayName(d.customers) : "Client inconnu"}
                  </div>
                </div>
                {d.serial_number && <span className="font-mono text-xs text-muted-foreground">{d.serial_number}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </DataTableShell>
    </PageContainer>
  );
}