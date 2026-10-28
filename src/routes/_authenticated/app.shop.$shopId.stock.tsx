import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useShop } from "@/components/shop/ShopLayout";
import { canManageShop } from "@/lib/shop-constants";
import { formatMoney, toCents } from "@/lib/money";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  listStockItems, stockStats, upsertStockItem, archiveStockItem, deleteStockItem,
  applyMovement, listMovements,
  listReservations, releaseReservation,
  listInventories, createInventory, getInventoryLines, updateInventoryLine, closeInventory,
} from "@/lib/stock.functions";
import { listQuarantine } from "@/lib/purchasing.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PageContainer, PageHeader, SectionCard, StatCard, DataTableShell,
  DialogShell, FormRow, FormActions, StatusBadge,
} from "@/components/ui-kit";
import {
  Package, Boxes, AlertTriangle, Euro, Plus, Pencil, Archive, Trash2,
  RotateCcw, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, ClipboardList,
  History, Bookmark, CheckCircle2, XCircle, Truck, ExternalLink,
} from "lucide-react";
import { StockSuppliersDialog } from "@/components/shop/StockSuppliersDialog";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/stock")({
  head: () => ({
    meta: [
      { title: "Stock — BPEI" },
      { name: "description", content: "Gestion complète du stock : produits, pièces, consommables, mouvements, réservations et inventaires." },
    ],
  }),
  component: StockPage,
});

type ItemRow = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  item_type: "product" | "part" | "consumable";
  unit: string;
  cost_price_cents: number;
  sell_price_cents: number;
  tax_rate: number;
  quantity: number;
  reserved_quantity: number;
  min_threshold: number;
  location: string | null;
  supplier_ref: string | null;
  active: boolean;
  archived_at: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  product: "Produit",
  part: "Pièce détachée",
  consumable: "Consommable",
};

const KIND_LABEL: Record<string, { label: string; tone: "success" | "destructive" | "info" }> = {
  in: { label: "Entrée", tone: "success" },
  out: { label: "Sortie", tone: "destructive" },
  adjust: { label: "Ajustement", tone: "info" },
};

/* ────────────── PAGE ────────────── */
function StockPage() {
  const ctx = useShop();
  const canManage = canManageShop(ctx.role);
  const [tab, setTab] = useState<"items" | "movements" | "reservations" | "inventories">("items");

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Stock"
        description="Produits, pièces détachées et consommables. Les articles publiés (actifs, prix > 0) apparaissent automatiquement sur la fiche publique BPEI de la boutique."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/b/$shopId" params={{ shopId: ctx.shopId }} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />Voir la fiche publique
            </Link>
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="items"><Package className="mr-2 h-4 w-4" />Articles</TabsTrigger>
          <TabsTrigger value="movements"><History className="mr-2 h-4 w-4" />Mouvements</TabsTrigger>
          <TabsTrigger value="reservations"><Bookmark className="mr-2 h-4 w-4" />Réservations</TabsTrigger>
          <TabsTrigger value="inventories"><ClipboardList className="mr-2 h-4 w-4" />Inventaires</TabsTrigger>
        </TabsList>
        <TabsContent value="items"><ItemsTab canManage={canManage} /></TabsContent>
        <TabsContent value="movements"><MovementsTab /></TabsContent>
        <TabsContent value="reservations"><ReservationsTab /></TabsContent>
        <TabsContent value="inventories"><InventoriesTab canManage={canManage} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/* ────────────── ARTICLES ────────────── */
function ItemsTab({ canManage }: { canManage: boolean }) {
  const ctx = useShop();
  const qc = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState("");
  const dq = useDebouncedValue(search, 300);
  const [typeFilter, setTypeFilter] = useState<"all" | ItemRow["item_type"]>("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [editing, setEditing] = useState<Partial<ItemRow> | null>(null);
  const [suppliersFor, setSuppliersFor] = useState<{ id: string; name: string } | null>(null);
  const [moving, setMoving] = useState<ItemRow | null>(null);
  const [toDelete, setToDelete] = useState<ItemRow | null>(null);

  const listFn = useServerFn(listStockItems);
  const statsFn = useServerFn(stockStats);
  const qFn = useServerFn(listQuarantine);
  const quarantineQ = useQuery({
    queryKey: ["quarantine-count", ctx.shopId],
    queryFn: () => qFn({ data: { shopId: ctx.shopId } }),
  });

  const quarantineTotal = (quarantineQ.data ?? []).reduce((s: number, r: any) => s + Number(r.quarantine_quantity ?? 0), 0);

  const upsertFn = useServerFn(upsertStockItem);
  const archiveFn = useServerFn(archiveStockItem);
  const deleteFn = useServerFn(deleteStockItem);

  const q = useQuery({
    queryKey: ["stock-items", ctx.shopId, includeArchived],
    queryFn: () => listFn({ data: { shopId: ctx.shopId, includeArchived } }),
  });
  const s = useQuery({
    queryKey: ["stock-stats", ctx.shopId],
    queryFn: () => statsFn({ data: { shopId: ctx.shopId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["stock-items", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["stock-stats", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["stock-movements", ctx.shopId] });
  };

  const archive = useMutation({
    mutationFn: (v: { id: string; restore?: boolean }) => archiveFn({ data: { shopId: ctx.shopId, ...v } }),
    onSuccess: (_, v) => { invalidate(); toast.success(v.restore ? "Restauré" : "Archivé"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { shopId: ctx.shopId, id } }),
    onSuccess: () => { invalidate(); setToDelete(null); toast.success("Supprimé"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (q.data ?? []) as ItemRow[];
  const filtered = useMemo(() => {
    const n = dq.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.item_type !== typeFilter) return false;
      if (lowOnly && Number(r.quantity) > Number(r.min_threshold)) return false;
      if (n) {
        const hay = [r.name, r.sku, r.barcode, r.category, r.brand, r.supplier_ref].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(n)) return false;
      }
      return true;
    });
  }, [rows, dq, typeFilter, lowOnly]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Articles actifs" value={s.data?.total ?? "—"} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Stock faible" value={s.data?.low ?? "—"} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Rupture" value={s.data?.out ?? "—"} icon={<XCircle className="h-4 w-4" />} />
        <StatCard label="Valeur (coût)" value={s.data ? formatMoney(s.data.stockValueCents) : "—"} icon={<Euro className="h-4 w-4" />} />
      </div>

      {quarantineTotal > 0 && (
        <Link
          to="/app/shop/$shopId/stock/quarantine"
          params={{ shopId: ctx.shopId }}
          className="flex items-center justify-between rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm hover:bg-warning/20"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <div>
              <div className="font-semibold text-warning">
                {quarantineTotal} unité{quarantineTotal > 1 ? "s" : ""} en quarantaine à traiter
              </div>
              <div className="text-xs text-muted-foreground">
                {(quarantineQ.data ?? []).length} article{(quarantineQ.data ?? []).length > 1 ? "s" : ""} concerné{(quarantineQ.data ?? []).length > 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm">Traiter →</Button>
        </Link>
      )}


      <SectionCard>
        <DataTableShell
          toolbar={
            <>
              <Input
                placeholder="Rechercher (nom, SKU, code-barres, catégorie, marque)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm h-9"
                aria-label="Rechercher un article"
              />
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger className="w-[170px] h-9" aria-label="Type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={lowOnly} onCheckedChange={setLowOnly} aria-label="Seuil bas uniquement" />
                Seuil bas
              </label>
              <label className="flex items-center gap-2 text-sm ml-auto">
                <Switch checked={includeArchived} onCheckedChange={setIncludeArchived} aria-label="Inclure archivés" />
                Archivés
              </label>
              {canManage && (
                <Button size="sm" onClick={() => setEditing({})} className="bg-electric text-electric-foreground hover:bg-electric/90">
                  <Plus className="mr-2 h-4 w-4" />Nouvel article
                </Button>
              )}
            </>
          }
          loading={q.isLoading}
          empty={!q.isLoading && filtered.length === 0}
          emptyIcon={<Boxes className="h-6 w-6" />}
          emptyTitle="Aucun article"
          emptyDescription={rows.length === 0 ? "Commencez par créer un produit, une pièce ou un consommable." : "Aucun résultat pour ces filtres."}
          emptyAction={canManage && rows.length === 0 ? (
            <Button onClick={() => setEditing({})}><Plus className="mr-2 h-4 w-4" />Nouvel article</Button>
          ) : null}
          footer={<span>{filtered.length} article{filtered.length > 1 ? "s" : ""} sur {rows.length}</span>}
        >
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Article</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Qté</th>
                <th className="px-4 py-3 font-medium text-right">Réservé</th>
                <th className="px-4 py-3 font-medium text-right">Dispo</th>
                <th className="px-4 py-3 font-medium text-right">Seuil</th>
                <th className="px-4 py-3 font-medium text-right">PA</th>
                <th className="px-4 py-3 font-medium text-right">PV</th>
                <th className="px-4 py-3 font-medium">État</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const qty = Number(r.quantity);
                const res = Number(r.reserved_quantity);
                const dispo = qty - res;
                const low = qty <= Number(r.min_threshold);
                const out = qty <= 0;
                const state = r.archived_at
                  ? { status: "archived", label: "Archivé", tone: "muted" as const }
                  : out
                  ? { status: "out", label: "Rupture", tone: "destructive" as const }
                  : low
                  ? { status: "low", label: "Stock bas", tone: "warning" as const }
                  : !r.active
                  ? { status: "inactive", label: "Désactivé", tone: "muted" as const }
                  : { status: "ok", label: "OK", tone: "success" as const };
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground truncate max-w-[280px]">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[r.sku && `SKU ${r.sku}`, r.category, r.brand].filter(Boolean).join(" • ") || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{TYPE_LABEL[r.item_type]}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtQty(qty)} {r.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtQty(res)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtQty(dispo)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{fmtQty(Number(r.min_threshold))}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatMoney(r.cost_price_cents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.sell_price_cents)}</td>
                    <td className="px-4 py-3"><StatusBadge status={state.status} label={state.label} tone={state.tone} size="sm" /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {!r.archived_at && (
                          <Button size="icon" variant="ghost" title="Mouvement" onClick={() => setMoving(r)} aria-label="Mouvement">
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                        )}
                        {!r.archived_at && canManage && (
                          <Button size="icon" variant="ghost" title="Fournisseurs" onClick={() => setSuppliersFor({ id: r.id, name: r.name })} aria-label="Fournisseurs">
                            <Truck className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && (
                          <>
                            <Button size="icon" variant="ghost" title="Modifier" onClick={() => setEditing(r)} aria-label="Modifier"><Pencil className="h-4 w-4" /></Button>
                            {r.archived_at ? (
                              <>
                                <Button size="icon" variant="ghost" title="Restaurer" onClick={() => archive.mutate({ id: r.id, restore: true })} aria-label="Restaurer">
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" title="Supprimer" onClick={() => setToDelete(r)} aria-label="Supprimer">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            ) : (
                              <Button size="icon" variant="ghost" title="Archiver" onClick={() => archive.mutate({ id: r.id })} aria-label="Archiver">
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DataTableShell>
      </SectionCard>

      {editing && (
        <ItemDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            await upsertFn({ data: { ...payload, shopId: ctx.shopId, id: editing.id } });
            invalidate();
            toast.success(editing.id ? "Modifié" : "Créé");
            setEditing(null);
          }}
        />
      )}
      <StockSuppliersDialog
        shopId={ctx.shopId}
        itemId={suppliersFor?.id ?? null}
        itemName={suppliersFor?.name}
        onClose={() => setSuppliersFor(null)}
      />

      {moving && (
        <MovementDialog
          item={moving}
          onClose={() => setMoving(null)}
          onDone={() => { invalidate(); setMoving(null); }}
        />
      )}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'article « {toDelete?.name} » et tout son historique de mouvements seront supprimés. Action irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && del.mutate(toDelete.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ────────────── DIALOG ARTICLE ────────────── */
const ItemFormZ = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  sku: z.string().max(80).optional().or(z.literal("")),
  barcode: z.string().max(80).optional().or(z.literal("")),
  category: z.string().max(100).optional().or(z.literal("")),
  brand: z.string().max(100).optional().or(z.literal("")),
  item_type: z.enum(["product", "part", "consumable"]),
  unit: z.string().min(1).max(30),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(100).optional().or(z.literal("")),
  supplier_ref: z.string().max(100).optional().or(z.literal("")),
  cost_price: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Prix invalide"),
  sell_price: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Prix invalide"),
  tax_rate: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 100, "TVA 0–100"),
  min_threshold: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Seuil invalide"),
  initial_quantity: z.string().optional(),
  active: z.boolean(),
});
type ItemFormV = z.infer<typeof ItemFormZ>;

function ItemDialog({ initial, onClose, onSubmit }: {
  initial: Partial<ItemRow>;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}) {
  const isNew = !initial.id;
  const form = useForm<ItemFormV>({
    resolver: zodResolver(ItemFormZ),
    defaultValues: {
      name: initial.name ?? "",
      sku: initial.sku ?? "",
      barcode: initial.barcode ?? "",
      category: initial.category ?? "",
      brand: initial.brand ?? "",
      item_type: (initial.item_type as any) ?? "part",
      unit: initial.unit ?? "unité",
      description: initial.description ?? "",
      location: initial.location ?? "",
      supplier_ref: initial.supplier_ref ?? "",
      cost_price: ((initial.cost_price_cents ?? 0) / 100).toString(),
      sell_price: ((initial.sell_price_cents ?? 0) / 100).toString(),
      tax_rate: (initial.tax_rate ?? 20).toString(),
      min_threshold: (initial.min_threshold ?? 0).toString(),
      initial_quantity: "0",
      active: initial.active ?? true,
    },
  });
  const [busy, setBusy] = useState(false);

  return (
    <DialogShell
      open
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "Nouvel article" : "Modifier l'article"}
      description="Produits vendus, pièces détachées pour réparations, ou consommables internes."
      size="xl"
    >
      <form
        id="stock-item-form"
        onSubmit={form.handleSubmit(async (v) => {
          setBusy(true);
          try {
            await onSubmit({
              name: v.name.trim(),
              sku: v.sku?.trim() || null,
              barcode: v.barcode?.trim() || null,
              category: v.category?.trim() || null,
              brand: v.brand?.trim() || null,
              item_type: v.item_type,
              unit: v.unit.trim(),
              description: v.description?.trim() || null,
              location: v.location?.trim() || null,
              supplier_ref: v.supplier_ref?.trim() || null,
              cost_price_cents: toCents(v.cost_price),
              sell_price_cents: toCents(v.sell_price),
              tax_rate: parseFloat(v.tax_rate),
              min_threshold: parseFloat(v.min_threshold),
              active: v.active,
              ...(isNew && v.initial_quantity ? { initial_quantity: parseFloat(v.initial_quantity) } : {}),
            });
          } finally { setBusy(false); }
        })}
        className="space-y-4"
      >
        <FormRow>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Nom *</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item_type">Type *</Label>
            <Select value={form.watch("item_type")} onValueChange={(v) => form.setValue("item_type", v as any)}>
              <SelectTrigger id="item_type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </FormRow>
        <FormRow>
          <div className="space-y-1.5"><Label htmlFor="sku">SKU (réf. interne)</Label><Input id="sku" {...form.register("sku")} /></div>
          <div className="space-y-1.5"><Label htmlFor="barcode">Code-barres / EAN</Label><Input id="barcode" {...form.register("barcode")} /></div>
          <div className="space-y-1.5"><Label htmlFor="unit">Unité *</Label><Input id="unit" {...form.register("unit")} placeholder="unité, ml, g, m…" /></div>
        </FormRow>
        <FormRow>
          <div className="space-y-1.5"><Label htmlFor="category">Catégorie</Label><Input id="category" {...form.register("category")} placeholder="Écrans, batteries…" /></div>
          <div className="space-y-1.5"><Label htmlFor="brand">Marque</Label><Input id="brand" {...form.register("brand")} placeholder="Apple, Samsung…" /></div>
          <div className="space-y-1.5"><Label htmlFor="location">Emplacement</Label><Input id="location" {...form.register("location")} placeholder="A3, Étagère 2…" /></div>
        </FormRow>
        <FormRow>
          <div className="space-y-1.5">
            <Label htmlFor="cost_price">Prix d'achat HT (€)</Label>
            <Input id="cost_price" inputMode="decimal" {...form.register("cost_price")} />
            {form.formState.errors.cost_price && <p className="text-xs text-destructive">{form.formState.errors.cost_price.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sell_price">Prix de vente HT (€)</Label>
            <Input id="sell_price" inputMode="decimal" {...form.register("sell_price")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tax_rate">TVA (%)</Label>
            <Input id="tax_rate" inputMode="decimal" {...form.register("tax_rate")} />
          </div>
        </FormRow>
        <FormRow>
          <div className="space-y-1.5">
            <Label htmlFor="min_threshold">Seuil d'alerte</Label>
            <Input id="min_threshold" inputMode="decimal" {...form.register("min_threshold")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier_ref">Réf. fournisseur</Label>
            <Input id="supplier_ref" {...form.register("supplier_ref")} />
          </div>
          {isNew && (
            <div className="space-y-1.5">
              <Label htmlFor="initial_quantity">Stock initial</Label>
              <Input id="initial_quantity" inputMode="decimal" {...form.register("initial_quantity")} />
            </div>
          )}
        </FormRow>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={3} {...form.register("description")} />
        </div>
        <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 p-3">
          <Switch checked={form.watch("active")} onCheckedChange={(v) => form.setValue("active", v)} className="mt-0.5" />
          <div className="text-sm">
            <div className="font-medium">Publier ce produit</div>
            <p className="text-xs text-muted-foreground">Utilisable en interne et visible sur la fiche publique de la boutique lorsque le stock disponible est &gt; 0 et le prix de vente renseigné.</p>
          </div>
        </div>
        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="stock-item-form" disabled={busy} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {busy ? "Enregistrement…" : isNew ? "Créer" : "Enregistrer"}
          </Button>
        </FormActions>
      </form>
    </DialogShell>
  );
}

/* ────────────── DIALOG MOUVEMENT ────────────── */
function MovementDialog({ item, onClose, onDone }: {
  item: ItemRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const ctx = useShop();
  const [kind, setKind] = useState<"in" | "out" | "adjust">("in");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const apply = useServerFn(applyMovement);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) { toast.error("Quantité invalide"); return; }
    setBusy(true);
    try {
      await apply({ data: { shopId: ctx.shopId, itemId: item.id, kind, quantity: qty, reason: reason || null, note: note || null } });
      toast.success("Mouvement enregistré");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <DialogShell
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Mouvement — ${item.name}`}
      description={`Stock actuel : ${fmtQty(Number(item.quantity))} ${item.unit} (réservé : ${fmtQty(Number(item.reserved_quantity))})`}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant={kind === "in" ? "default" : "outline"} onClick={() => setKind("in")}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />Entrée
          </Button>
          <Button type="button" variant={kind === "out" ? "default" : "outline"} onClick={() => setKind("out")}>
            <ArrowUpFromLine className="mr-2 h-4 w-4" />Sortie
          </Button>
          <Button type="button" variant={kind === "adjust" ? "default" : "outline"} onClick={() => setKind("adjust")}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />Ajuster
          </Button>
        </div>
        <FormRow>
          <div className="space-y-1.5">
            <Label htmlFor="mv-qty">{kind === "adjust" ? "Nouvelle quantité" : "Quantité"}</Label>
            <Input id="mv-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mv-reason">Motif</Label>
            <Input id="mv-reason" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={kind === "in" ? "réappro fournisseur" : kind === "out" ? "utilisé dossier #123" : "correction inventaire"} />
          </div>
        </FormRow>
        <div className="space-y-1.5">
          <Label htmlFor="mv-note">Note</Label>
          <Textarea id="mv-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {busy ? "…" : "Valider"}
          </Button>
        </FormActions>
      </form>
    </DialogShell>
  );
}

/* ────────────── MOUVEMENTS ────────────── */
function MovementsTab() {
  const ctx = useShop();
  const listFn = useServerFn(listMovements);
  const q = useQuery({
    queryKey: ["stock-movements", ctx.shopId],
    queryFn: () => listFn({ data: { shopId: ctx.shopId, limit: 200 } }),
  });
  const rows = (q.data ?? []) as any[];

  return (
    <SectionCard>
      <DataTableShell
        loading={q.isLoading}
        empty={!q.isLoading && rows.length === 0}
        emptyIcon={<History className="h-6 w-6" />}
        emptyTitle="Aucun mouvement"
        emptyDescription="Les entrées, sorties et ajustements de stock apparaîtront ici."
        footer={<span>{rows.length} mouvement{rows.length > 1 ? "s" : ""}</span>}
      >
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Article</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium text-right">Quantité</th>
              <th className="px-4 py-3 font-medium text-right">Solde</th>
              <th className="px-4 py-3 font-medium">Motif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((m) => {
              const k = KIND_LABEL[m.kind];
              return (
                <tr key={m.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(m.created_at).toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.item?.name ?? "—"}</div>
                    {m.item?.sku && <div className="text-xs text-muted-foreground">{m.item.sku}</div>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={m.kind} label={k?.label ?? m.kind} tone={k?.tone} size="sm" /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmtQty(Number(m.quantity))} {m.item?.unit ?? ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtQty(Number(m.balance_after))}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.reason ?? "—"}
                    {m.note && <div className="text-xs">{m.note}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTableShell>
    </SectionCard>
  );
}

/* ────────────── RÉSERVATIONS ────────────── */
function ReservationsTab() {
  const ctx = useShop();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"active" | "consumed" | "released">("active");
  const listFn = useServerFn(listReservations);
  const releaseFn = useServerFn(releaseReservation);

  const q = useQuery({
    queryKey: ["stock-reservations", ctx.shopId, status],
    queryFn: () => listFn({ data: { shopId: ctx.shopId, status } }),
  });
  const rel = useMutation({
    mutationFn: (v: { id: string; consume?: boolean }) => releaseFn({ data: { shopId: ctx.shopId, ...v } }),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["stock-reservations", ctx.shopId] });
      qc.invalidateQueries({ queryKey: ["stock-items", ctx.shopId] });
      qc.invalidateQueries({ queryKey: ["stock-stats", ctx.shopId] });
      qc.invalidateQueries({ queryKey: ["stock-movements", ctx.shopId] });
      toast.success(v.consume ? "Consommée" : "Libérée");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (q.data ?? []) as any[];
  return (
    <SectionCard>
      <DataTableShell
        toolbar={
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Actives</SelectItem>
              <SelectItem value="consumed">Consommées</SelectItem>
              <SelectItem value="released">Libérées</SelectItem>
            </SelectContent>
          </Select>
        }
        loading={q.isLoading}
        empty={!q.isLoading && rows.length === 0}
        emptyIcon={<Bookmark className="h-6 w-6" />}
        emptyTitle="Aucune réservation"
        emptyDescription="Réservez du stock pour un dossier de réparation depuis sa fiche (à venir dans le module Réparations)."
        footer={<span>{rows.length} réservation{rows.length > 1 ? "s" : ""}</span>}
      >
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Article</th>
              <th className="px-4 py-3 font-medium text-right">Quantité</th>
              <th className="px-4 py-3 font-medium">Référence</th>
              <th className="px-4 py-3 font-medium">État</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.item?.name ?? "—"}</div>
                  {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtQty(Number(r.quantity))} {r.item?.unit ?? ""}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.reference_type ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={r.status}
                    label={r.status === "active" ? "Active" : r.status === "consumed" ? "Consommée" : "Libérée"}
                    tone={r.status === "active" ? "info" : r.status === "consumed" ? "success" : "muted"}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-3">
                  {r.status === "active" && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => rel.mutate({ id: r.id, consume: true })}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Consommer
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => rel.mutate({ id: r.id })}>
                        <XCircle className="mr-1 h-3.5 w-3.5" />Libérer
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>
    </SectionCard>
  );
}

/* ────────────── INVENTAIRES ────────────── */
function InventoriesTab({ canManage }: { canManage: boolean }) {
  const ctx = useShop();
  const qc = useQueryClient();
  const [openInv, setOpenInv] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const listFn = useServerFn(listInventories);
  const createFn = useServerFn(createInventory);
  const closeFn = useServerFn(closeInventory);

  const q = useQuery({
    queryKey: ["stock-inventories", ctx.shopId],
    queryFn: () => listFn({ data: { shopId: ctx.shopId } }),
  });
  const rows = (q.data ?? []) as any[];

  const create = useMutation({
    mutationFn: (v: { name: string; note?: string }) => createFn({ data: { shopId: ctx.shopId, ...v } }),
    onSuccess: (inv: any) => {
      qc.invalidateQueries({ queryKey: ["stock-inventories", ctx.shopId] });
      setCreating(false);
      setOpenInv(inv.id);
      toast.success("Inventaire créé");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const close = useMutation({
    mutationFn: (id: string) => closeFn({ data: { shopId: ctx.shopId, inventoryId: id } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["stock-inventories", ctx.shopId] });
      qc.invalidateQueries({ queryKey: ["stock-items", ctx.shopId] });
      qc.invalidateQueries({ queryKey: ["stock-stats", ctx.shopId] });
      qc.invalidateQueries({ queryKey: ["stock-movements", ctx.shopId] });
      setOpenInv(null);
      toast.success(`Inventaire clôturé — ${r.adjustments} ajustement${r.adjustments > 1 ? "s" : ""}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard>
      <DataTableShell
        toolbar={canManage && (
          <Button size="sm" onClick={() => setCreating(true)} className="bg-electric text-electric-foreground hover:bg-electric/90">
            <Plus className="mr-2 h-4 w-4" />Nouvel inventaire
          </Button>
        )}
        loading={q.isLoading}
        empty={!q.isLoading && rows.length === 0}
        emptyIcon={<ClipboardList className="h-6 w-6" />}
        emptyTitle="Aucun inventaire"
        emptyDescription="Créez un inventaire pour recompter physiquement votre stock et ajuster automatiquement les écarts."
        emptyAction={canManage ? (
          <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Nouvel inventaire</Button>
        ) : null}
      >
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Démarré</th>
              <th className="px-4 py-3 font-medium">Clôturé</th>
              <th className="px-4 py-3 font-medium">État</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString("fr-FR")}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.closed_at ? new Date(r.closed_at).toLocaleString("fr-FR") : "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={r.status}
                    label={r.status === "closed" ? "Clôturé" : r.status === "in_progress" ? "En cours" : "Brouillon"}
                    tone={r.status === "closed" ? "success" : r.status === "in_progress" ? "info" : "muted"}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => setOpenInv(r.id)}>Ouvrir</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      {creating && (
        <CreateInventoryDialog onClose={() => setCreating(false)} onSubmit={(v) => create.mutate(v)} busy={create.isPending} />
      )}
      {openInv && (
        <InventoryLinesDialog
          inventoryId={openInv}
          canClose={canManage && (rows.find((r) => r.id === openInv)?.status === "in_progress")}
          onClose={() => setOpenInv(null)}
          onCloseInventory={() => close.mutate(openInv)}
          closing={close.isPending}
        />
      )}
    </SectionCard>
  );
}

function CreateInventoryDialog({ onClose, onSubmit, busy }: {
  onClose: () => void;
  onSubmit: (v: { name: string; note?: string }) => void;
  busy: boolean;
}) {
  const [name, setName] = useState(`Inventaire ${new Date().toLocaleDateString("fr-FR")}`);
  const [note, setNote] = useState("");
  return (
    <DialogShell open onOpenChange={(o) => !o && onClose()} title="Nouvel inventaire"
      description="Un cliché du stock actuel sera créé. Comptez chaque article puis clôturez pour ajuster automatiquement les écarts.">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name: name.trim(), note: note.trim() || undefined }); }} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="inv-name">Nom *</Label>
          <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-note">Note</Label>
          <Textarea id="inv-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy || !name.trim()} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {busy ? "…" : "Créer"}
          </Button>
        </FormActions>
      </form>
    </DialogShell>
  );
}

function InventoryLinesDialog({ inventoryId, canClose, onClose, onCloseInventory, closing }: {
  inventoryId: string;
  canClose: boolean | undefined;
  onClose: () => void;
  onCloseInventory: () => void;
  closing: boolean;
}) {
  const ctx = useShop();
  const qc = useQueryClient();
  const linesFn = useServerFn(getInventoryLines);
  const updateFn = useServerFn(updateInventoryLine);
  const q = useQuery({
    queryKey: ["stock-inventory-lines", ctx.shopId, inventoryId],
    queryFn: () => linesFn({ data: { shopId: ctx.shopId, inventoryId } }),
  });
  const rows = (q.data ?? []) as any[];

  const update = useMutation({
    mutationFn: (v: { id: string; countedQty: number | null }) => updateFn({ data: { shopId: ctx.shopId, ...v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-inventory-lines", ctx.shopId, inventoryId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogShell open onOpenChange={(o) => !o && onClose()} title="Feuille d'inventaire"
      description="Saisissez la quantité comptée pour chaque article. La clôture applique automatiquement les ajustements."
      size="xl"
      footer={canClose && (
        <div className="flex justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          <Button onClick={onCloseInventory} disabled={closing} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {closing ? "Clôture…" : "Clôturer et appliquer les ajustements"}
          </Button>
        </div>
      )}
    >
      {q.isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Article</th>
                <th className="px-3 py-2 font-medium text-right">Attendu</th>
                <th className="px-3 py-2 font-medium text-right w-32">Compté</th>
                <th className="px-3 py-2 font-medium text-right">Écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.item?.name ?? "—"}</div>
                    {l.item?.sku && <div className="text-xs text-muted-foreground">{l.item.sku}</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtQty(Number(l.expected_qty))}</td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      inputMode="decimal"
                      defaultValue={l.counted_qty ?? ""}
                      disabled={!canClose}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const n = v === "" ? null : parseFloat(v);
                        if (n !== null && isNaN(n)) return;
                        if (n !== l.counted_qty) update.mutate({ id: l.id, countedQty: n });
                      }}
                      className="h-8 text-right tabular-nums"
                    />
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${
                    l.counted_qty === null ? "text-muted-foreground" :
                    Number(l.variance) === 0 ? "text-success" :
                    Number(l.variance) < 0 ? "text-destructive" : "text-warning"
                  }`}>
                    {l.counted_qty === null ? "—" : (Number(l.variance) > 0 ? `+${fmtQty(Number(l.variance))}` : fmtQty(Number(l.variance)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DialogShell>
  );
}

/* ────────────── utils ────────────── */
function fmtQty(n: number): string {
  if (!isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}