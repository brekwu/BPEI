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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/shop/StatusBadge";
import { Plus, Search, Wrench } from "lucide-react";
import {
  REPAIR_STATUS_LABEL, REPAIR_PRIORITY_LABEL, customerDisplayName,
  type RepairStatus, type RepairPriority,
} from "@/lib/shop-constants";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/repairs/")({
  head: () => ({ meta: [{ title: "Réparations — BPEI" }] }),
  component: RepairsList,
});

function RepairsList() {
  const { shopId } = useShop();
  const base = `/app/shop/${shopId}`;
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [status, setStatus] = useState<"all" | RepairStatus>("all");
  const [priority, setPriority] = useState<"all" | RepairPriority>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["repairs", shopId, dq, status, priority],
    queryFn: async () => {
      let query = supabase.from("repairs")
        .select("id, repair_number, status, priority, created_at, estimated_completion_at, customers(customer_type, company_name, first_name, last_name), devices(brand, model, device_type)")
        .eq("shop_id", shopId).is("archived_at", null)
        .order("created_at", { ascending: false }).limit(200);
      if (status !== "all") query = query.eq("status", status);
      if (priority !== "all") query = query.eq("priority", priority);
      if (dq.trim()) query = query.ilike("repair_number", `%${dq.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = data ?? [];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Boutique"
        title="Réparations"
        description="Suivi de tous les dossiers en cours et clôturés."
        actions={
          <Button asChild>
            <Link to="/app/shop/$shopId/repairs/new" params={{ shopId }}><Plus className="mr-2 h-4 w-4" />Nouvelle réparation</Link>
          </Button>
        }
      />

      <DataTableShell
        toolbar={
          <>
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Numéro de dossier…" className="pl-9" aria-label="Rechercher une réparation" />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(REPAIR_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Priorité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorités</SelectItem>
                {Object.entries(REPAIR_PRIORITY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        loading={isLoading}
        empty={rows.length === 0}
        emptyIcon={<Wrench className="h-5 w-5" />}
        emptyTitle="Aucune réparation"
        emptyDescription="Créez un dossier depuis un devis, un rendez-vous ou directement."
        emptyAction={
          <Button asChild>
            <Link to="/app/shop/$shopId/repairs/new" params={{ shopId }}><Plus className="mr-2 h-4 w-4" />Nouvelle réparation</Link>
          </Button>
        }
      >
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">N°</th>
              <th className="px-4 py-2.5 text-left font-medium">Client</th>
              <th className="px-4 py-2.5 text-left font-medium">Appareil</th>
              <th className="px-4 py-2.5 text-left font-medium">Priorité</th>
              <th className="px-4 py-2.5 text-left font-medium">Statut</th>
              <th className="px-4 py-2.5 text-left font-medium">Créé</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-2.5 font-mono text-xs">
                  <Link to="/app/shop/$shopId/repairs/$repairId" params={{ shopId, repairId: r.id }} className="font-medium text-electric hover:underline">{r.repair_number}</Link>
                </td>
                <td className="px-4 py-2.5">{r.customers ? customerDisplayName(r.customers) : "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.devices ? [r.devices.brand, r.devices.model].filter(Boolean).join(" ") || "—" : "—"}</td>
                <td className="px-4 py-2.5"><PriorityBadge priority={r.priority} /></td>
                <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </PageContainer>
  );
}