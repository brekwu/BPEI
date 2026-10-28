import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import {
  listCatalog, upsertCatalogItem, archiveCatalogItem,
  duplicateCatalogItem, deleteCatalogItem, catalogStats,
} from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatMoney, toCents } from "@/lib/money";
import { LINE_TYPE_LABEL } from "@/lib/finance-constants";
import type { DocumentLineType } from "@/lib/finance-constants";
import { Archive, Copy, Pencil, Plus, RotateCcw, Trash2, Package, Layers, EyeOff, ExternalLink } from "lucide-react";
import { canManageShop } from "@/lib/shop-constants";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  PageContainer, PageHeader, SectionCard, StatCard, DataTableShell,
  DialogShell, FormRow, FormActions, StatusBadge, EmptyState,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/catalog")({
  head: () => ({ meta: [{ title: "Catalogue — BPEI" }] }),
  component: CatalogPage,
});

type CatalogRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  line_type: DocumentLineType;
  internal_reference: string | null;
  default_quantity: number;
  unit: string;
  unit_price_cents: number;
  tax_rate: number;
  estimated_duration_minutes: number | null;
  active: boolean;
  archived_at: string | null;
};

function CatalogPage() {
  const ctx = useShop();
  const qc = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [search, setSearch] = useState("");
  const dq = useDebouncedValue(search, 300);
  const [typeFilter, setTypeFilter] = useState<"all" | DocumentLineType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<CatalogRow> | null>(null);
  const [toDelete, setToDelete] = useState<CatalogRow | null>(null);
  const canManage = canManageShop(ctx.role);

  const listFn = useServerFn(listCatalog);
  const statsFn = useServerFn(catalogStats);
  const upsertFn = useServerFn(upsertCatalogItem);
  const archiveFn = useServerFn(archiveCatalogItem);
  const dupFn = useServerFn(duplicateCatalogItem);
  const deleteFn = useServerFn(deleteCatalogItem);

  const q = useQuery({
    queryKey: ["catalog", ctx.shopId, includeArchived],
    queryFn: () => listFn({ data: { shopId: ctx.shopId, includeArchived } }),
  });
  const stats = useQuery({
    queryKey: ["catalog-stats", ctx.shopId],
    queryFn: () => statsFn({ data: { shopId: ctx.shopId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["catalog", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["catalog-stats", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["services-all", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["services", ctx.shopId] });
  };

  const archive = useMutation({
    mutationFn: (v: { id: string; restore?: boolean }) => archiveFn({ data: { shopId: ctx.shopId, ...v } }),
    onSuccess: (_, v) => { invalidate(); toast.success(v.restore ? "Article restauré" : "Article archivé"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dup = useMutation({
    mutationFn: (id: string) => dupFn({ data: { shopId: ctx.shopId, id } }),
    onSuccess: () => { invalidate(); toast.success("Dupliqué"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { shopId: ctx.shopId, id } }),
    onSuccess: () => { invalidate(); setToDelete(null); toast.success("Supprimé définitivement"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (q.data ?? []) as CatalogRow[];
  const filtered = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.line_type !== typeFilter) return false;
      if (categoryFilter !== "all" && (r.category ?? "") !== categoryFilter) return false;
      if (needle) {
        const hay = [r.name, r.description, r.category, r.internal_reference].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, dq, typeFilter, categoryFilter]);

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Catalogue de prestations"
        description="Prestations, produits et main-d'œuvre facturables. Les articles actifs apparaissent dans les devis, les factures, la prise de RDV en ligne et sur la fiche publique de votre boutique."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/b/$shopId" params={{ shopId: ctx.shopId }} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />Voir la fiche publique
              </Link>
            </Button>
            {canManage && (
              <Button onClick={() => setEditing({})} className="bg-electric text-electric-foreground hover:bg-electric/90">
                <Plus className="mr-2 h-4 w-4" />Nouvel article
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total actifs" value={stats.data?.active ?? "—"} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Catégories" value={stats.data?.categories.length ?? "—"} icon={<Layers className="h-4 w-4" />} />
        <StatCard label="Désactivés" value={stats.data?.inactive ?? "—"} icon={<EyeOff className="h-4 w-4" />} />
        <StatCard label="Archivés" value={stats.data?.archived ?? "—"} icon={<Archive className="h-4 w-4" />} />
      </div>

      <SectionCard>
        <DataTableShell
          toolbar={
            <>
              <Input
                placeholder="Rechercher (nom, description, catégorie, référence)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm h-9"
                aria-label="Rechercher un article"
              />
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
                <SelectTrigger className="w-[160px] h-9" aria-label="Type"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  {Object.entries(LINE_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px] h-9" aria-label="Catégorie"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {(stats.data?.categories ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm ml-auto">
                <Switch checked={includeArchived} onCheckedChange={setIncludeArchived} aria-label="Inclure les archivés" />
                Inclure archivés
              </label>
            </>
          }
          loading={q.isLoading}
          empty={!q.isLoading && filtered.length === 0}
          emptyIcon={<Package className="h-6 w-6" />}
          emptyTitle="Aucun article"
          emptyDescription={rows.length === 0 ? "Commencez par créer une prestation ou un produit." : "Aucun résultat pour ces filtres."}
          emptyAction={
            canManage && rows.length === 0 ? (
              <Button onClick={() => setEditing({})}><Plus className="mr-2 h-4 w-4" />Nouvel article</Button>
            ) : null
          }
          footer={
            <span>{filtered.length} article{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""} sur {rows.length}</span>
          }
        >
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Prix HT</th>
                <th className="px-4 py-3 font-medium text-right">TVA</th>
                <th className="px-4 py-3 font-medium text-right">Prix TTC</th>
                <th className="px-4 py-3 font-medium">État</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const ttc = Math.round(r.unit_price_cents * (1 + Number(r.tax_rate) / 100));
                const state: { status: string; label: string; tone: "muted" | "success" | "warning" } = r.archived_at
                  ? { status: "archived", label: "Archivé", tone: "muted" }
                  : r.active
                  ? { status: "active", label: "Actif", tone: "success" }
                  : { status: "inactive", label: "Désactivé", tone: "warning" };
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground truncate max-w-[280px]">{r.name}</div>
                      {r.internal_reference && <div className="text-xs text-muted-foreground">Réf. {r.internal_reference}</div>}
                      {r.description && <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.category ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{LINE_TYPE_LABEL[r.line_type]}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(r.unit_price_cents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{Number(r.tax_rate)} %</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(ttc)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={state.status} label={state.label} tone={state.tone} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Modifier" onClick={() => setEditing(r)} aria-label="Modifier"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Dupliquer" onClick={() => dup.mutate(r.id)} aria-label="Dupliquer"><Copy className="h-4 w-4" /></Button>
                          {r.archived_at ? (
                            <>
                              <Button size="icon" variant="ghost" title="Restaurer" onClick={() => archive.mutate({ id: r.id, restore: true })} aria-label="Restaurer">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="Supprimer définitivement" onClick={() => setToDelete(r)} aria-label="Supprimer définitivement">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <Button size="icon" variant="ghost" title="Archiver" onClick={() => archive.mutate({ id: r.id })} aria-label="Archiver">
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
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
          existingCategories={stats.data?.categories ?? []}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            await upsertFn({ data: { ...payload, shopId: ctx.shopId, id: editing.id } });
            invalidate();
            toast.success(editing.id ? "Article modifié" : "Article créé");
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement « {toDelete?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'article ne pourra plus être restauré. Si l'article est utilisé sur des devis ou factures, la suppression sera refusée — préférez l'archivage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && del.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

const itemSchema = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  category: z.string().max(100).optional().or(z.literal("")),
  line_type: z.enum(["service", "product", "labour", "discount", "other"]),
  internal_reference: z.string().max(100).optional().or(z.literal("")),
  default_quantity: z.number().min(0),
  unit: z.string().min(1).max(30),
  unit_price_eur: z.number().min(0),
  tax_rate: z.number().min(0).max(100),
  estimated_duration_minutes: z.union([z.number().int().min(0), z.nan()]).optional(),
  active: z.boolean(),
});
type ItemFormData = z.infer<typeof itemSchema>;

function ItemDialog({
  initial,
  existingCategories,
  onClose,
  onSubmit,
}: {
  initial: Partial<CatalogRow>;
  existingCategories: string[];
  onClose: () => void;
  onSubmit: (v: {
    name: string;
    description?: string | null;
    category?: string | null;
    line_type: DocumentLineType;
    internal_reference?: string | null;
    default_quantity: number;
    unit: string;
    unit_price_cents: number;
    tax_rate: number;
    estimated_duration_minutes?: number | null;
    active: boolean;
  }) => void | Promise<void>;
}) {
  const form = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: initial.name ?? "",
      description: initial.description ?? "",
      category: initial.category ?? "",
      line_type: (initial.line_type as DocumentLineType) ?? "service",
      internal_reference: initial.internal_reference ?? "",
      default_quantity: Number(initial.default_quantity ?? 1),
      unit: initial.unit ?? "unité",
      unit_price_eur: (initial.unit_price_cents ?? 0) / 100,
      tax_rate: Number(initial.tax_rate ?? 20),
      estimated_duration_minutes: initial.estimated_duration_minutes ?? undefined,
      active: initial.active ?? true,
    },
  });
  const priceEur = form.watch("unit_price_eur");
  const taxRate = form.watch("tax_rate");
  const ttcCents = Math.round(toCents(String(priceEur || 0)) * (1 + Number(taxRate || 0) / 100));

  async function handle(values: ItemFormData) {
    await onSubmit({
      name: values.name,
      description: values.description?.trim() || null,
      category: values.category?.trim() || null,
      line_type: values.line_type,
      internal_reference: values.internal_reference?.trim() || null,
      default_quantity: values.default_quantity,
      unit: values.unit,
      unit_price_cents: toCents(String(values.unit_price_eur)),
      tax_rate: values.tax_rate,
      estimated_duration_minutes:
        typeof values.estimated_duration_minutes === "number" && !Number.isNaN(values.estimated_duration_minutes)
          ? values.estimated_duration_minutes
          : null,
      active: values.active,
    });
  }

  return (
    <DialogShell
      open
      onOpenChange={(v) => !v && onClose()}
      size="lg"
      title={initial.id ? "Modifier l'article" : "Nouvel article du catalogue"}
      description="Ces informations pré-remplissent les lignes de devis et factures et alimentent la prise de RDV en ligne."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={form.handleSubmit(handle)} disabled={form.formState.isSubmitting} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form className="space-y-5" onSubmit={form.handleSubmit(handle)}>
        <FormRow>
          <div className="sm:col-span-2">
            <Label htmlFor="name">Nom *</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
        </FormRow>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={3} {...form.register("description")} />
        </div>
        <FormRow>
          <div>
            <Label htmlFor="category">Catégorie</Label>
            <Input
              id="category"
              list="catalog-categories"
              placeholder="Ex. Écrans, Batteries, Diagnostic…"
              {...form.register("category")}
            />
            <datalist id="catalog-categories">
              {existingCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <Label htmlFor="internal_reference">Référence interne</Label>
            <Input id="internal_reference" placeholder="SKU / code" {...form.register("internal_reference")} />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <Label>Type *</Label>
            <Select value={form.watch("line_type")} onValueChange={(v) => form.setValue("line_type", v as DocumentLineType)}>
              <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LINE_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="unit">Unité *</Label>
            <Input id="unit" {...form.register("unit")} />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <Label htmlFor="unit_price_eur">Prix HT (€) *</Label>
            <Input id="unit_price_eur" type="number" step="0.01" min="0" {...form.register("unit_price_eur", { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="tax_rate">TVA (%) *</Label>
            <Input id="tax_rate" type="number" step="0.1" min="0" max="100" {...form.register("tax_rate", { valueAsNumber: true })} />
          </div>
        </FormRow>
        <FormRow>
          <div>
            <Label htmlFor="default_quantity">Quantité par défaut</Label>
            <Input id="default_quantity" type="number" step="0.01" min="0" {...form.register("default_quantity", { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="estimated_duration_minutes">Durée estimée (min)</Label>
            <Input
              id="estimated_duration_minutes"
              type="number"
              min="0"
              placeholder="Utilisée pour la prise de RDV"
              {...form.register("estimated_duration_minutes", { valueAsNumber: true })}
            />
          </div>
        </FormRow>

        <div className="rounded-md border border-electric/20 bg-electric-soft px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Prix TTC calculé</span>
            <span className="font-display text-lg font-semibold tabular-nums text-electric">{formatMoney(ttcCents)}</span>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 p-3">
          <Switch id="active" checked={form.watch("active")} onCheckedChange={(v) => form.setValue("active", v)} className="mt-0.5" />
          <div className="text-sm">
            <Label htmlFor="active" className="cursor-pointer font-medium">Publier cet article</Label>
            <p className="text-xs text-muted-foreground">Utilisable dans les devis/factures, la prise de RDV en ligne, et visible sur votre fiche publique BPEI.</p>
          </div>
        </div>

        <FormActions className="pt-0">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={form.formState.isSubmitting} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </FormActions>
      </form>
    </DialogShell>
  );
}

/** Utilisé pour EmptyState pour éviter un import inutilisé. */
void EmptyState;