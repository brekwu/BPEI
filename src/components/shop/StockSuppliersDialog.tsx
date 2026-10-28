import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listItemSuppliers, upsertItemSupplier, deleteItemSupplier,
  setPrimaryItemSupplier, listPurchasePriceHistory,
} from "@/lib/stock-suppliers.functions";
import { listSuppliers } from "@/lib/purchasing.functions";
import { DialogShell, FormActions } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Plus, History, Pencil, ShoppingCart } from "lucide-react";
import { formatMoney, formatDate, fromCents, toCents } from "@/lib/money";
import { CreatePOFromItemDialog } from "./CreatePOFromItemDialog";


interface Props {
  shopId: string;
  itemId: string | null;
  itemName?: string;
  onClose: () => void;
}

export function StockSuppliersDialog({ shopId, itemId, itemName, onClose }: Props) {
  const open = !!itemId;
  const qc = useQueryClient();
  const listFn = useServerFn(listItemSuppliers);
  const supFn = useServerFn(listSuppliers);
  const upsertFn = useServerFn(upsertItemSupplier);
  const delFn = useServerFn(deleteItemSupplier);
  const setPrimFn = useServerFn(setPrimaryItemSupplier);
  const historyFn = useServerFn(listPurchasePriceHistory);

  const [editing, setEditing] = useState<any | null>(null);
  const [adding, setAdding] = useState(false);
  const [poFromOffer, setPoFromOffer] = useState<any | null>(null);


  const q = useQuery({
    queryKey: ["item-suppliers", shopId, itemId],
    queryFn: () => listFn({ data: { shopId, itemId: itemId! } }),
    enabled: open,
  });
  const s = useQuery({
    queryKey: ["suppliers-active", shopId],
    queryFn: () => supFn({ data: { shopId } }),
    enabled: open,
  });
  const h = useQuery({
    queryKey: ["price-history", shopId, itemId],
    queryFn: () => historyFn({ data: { shopId, itemId: itemId! } }),
    enabled: open,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["item-suppliers", shopId, itemId] });
    qc.invalidateQueries({ queryKey: ["price-history", shopId, itemId] });
  };

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { shopId, id } }),
    onSuccess: () => { invalidate(); toast.success("Fournisseur supprimé"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setPrim = useMutation({
    mutationFn: (id: string) => setPrimFn({ data: { shopId, id, itemId: itemId! } }),
    onSuccess: () => { invalidate(); toast.success("Fournisseur principal mis à jour"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (q.data ?? []) as any[];
  const allSuppliers = (s.data ?? []) as any[];
  const linkedIds = new Set(rows.map((r) => r.supplier_id));

  return (
    <>
      <DialogShell
        open={open}
        onOpenChange={(v) => { if (!v) onClose(); }}
        title="Fournisseurs et prix d'achat"
        description={itemName ? `Article : ${itemName}` : undefined}
        size="xl"
      >
        <Tabs defaultValue="suppliers" className="w-full">
          <TabsList>
            <TabsTrigger value="suppliers">Fournisseurs ({rows.length})</TabsTrigger>
            <TabsTrigger value="history">Historique prix ({h.data?.rows?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAdding(true)} disabled={allSuppliers.length === linkedIds.size}>
                <Plus className="mr-2 h-4 w-4" />Ajouter un fournisseur
              </Button>
            </div>
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Aucun fournisseur associé à cet article.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Fournisseur</th>
                      <th className="px-3 py-2">Référence</th>
                      <th className="px-3 py-2 text-right">Prix HT</th>
                      <th className="px-3 py-2 text-right">Min / Pack</th>
                      <th className="px-3 py-2 text-right">Délai</th>
                      <th className="px-3 py-2">MàJ</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {r.is_primary && <Star className="h-3.5 w-3.5 fill-electric text-electric" />}
                            <span className="font-medium">{r.supplier?.name ?? "—"}</span>
                            {!r.active && <Badge variant="outline" className="text-[10px]">Inactif</Badge>}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{r.supplier_product_reference ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatMoney(r.purchase_price_cents)}</td>
                        <td className="px-3 py-2 text-right text-xs">{r.min_order_qty} / {r.pack_qty}</td>
                        <td className="px-3 py-2 text-right text-xs">
                          {r.estimated_delivery_days != null ? `${r.estimated_delivery_days}j` : "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {r.last_price_update_at ? formatDate(r.last_price_update_at) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {r.active && r.supplier && (
                              <Button
                                size="sm" variant="ghost" title="Créer un bon de commande"
                                onClick={() => setPoFromOffer(r)}
                              >
                                <ShoppingCart className="h-3.5 w-3.5 text-electric" />
                              </Button>
                            )}
                            {!r.is_primary && (
                              <Button
                                size="sm" variant="ghost"
                                title="Définir comme principal"
                                onClick={() => setPrim.mutate(r.id)}
                              >
                                <Star className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => setEditing(r)} title="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" title="Supprimer"
                              onClick={() => {
                                if (confirm("Supprimer ce fournisseur pour cet article ?")) del.mutate(r.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {h.data?.stats && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatBox label="Dernier prix" value={formatMoney(h.data.stats.last)} />
                <StatBox label="Prix minimum" value={formatMoney(h.data.stats.min)} />
                <StatBox label="Prix maximum" value={formatMoney(h.data.stats.max)} />
                <StatBox label="Nombre de changements" value={String(h.data.stats.changes)} />
              </div>
            )}
            {(h.data?.rows?.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <History className="mx-auto mb-2 h-5 w-5 opacity-60" />
                Aucun changement de prix enregistré pour l'instant.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Fournisseur</th>
                      <th className="px-3 py-2 text-right">Ancien</th>
                      <th className="px-3 py-2 text-right">Nouveau</th>
                      <th className="px-3 py-2 text-right">Variation</th>
                      <th className="px-3 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(h.data?.rows ?? []).map((r: any) => {
                      const diff = r.old_price_cents != null ? r.new_price_cents - r.old_price_cents : null;
                      return (
                        <tr key={r.id}>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(r.changed_at)}</td>
                          <td className="px-3 py-2">{r.supplier?.name ?? "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {r.old_price_cents != null ? formatMoney(r.old_price_cents) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{formatMoney(r.new_price_cents)}</td>
                          <td className={`px-3 py-2 text-right text-xs font-mono ${diff == null ? "" : diff > 0 ? "text-destructive" : "text-success"}`}>
                            {diff == null ? "—" : `${diff > 0 ? "+" : ""}${formatMoney(diff)}`}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {r.source === "po_receive" ? "Réception" : r.source === "manual" ? "Manuel" : r.source}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogShell>

      <SupplierEditDialog
        shopId={shopId}
        itemId={itemId}
        editing={editing}
        adding={adding}
        allSuppliers={allSuppliers}
        linkedIds={linkedIds}
        upsertFn={upsertFn}
        onDone={() => { setEditing(null); setAdding(false); invalidate(); }}
      />
      {poFromOffer && itemId && (
        <CreatePOFromItemDialog
          shopId={shopId}
          itemId={itemId}
          itemName={itemName ?? "—"}
          offer={poFromOffer}
          onClose={() => setPoFromOffer(null)}
        />
      )}
    </>

  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function SupplierEditDialog({
  shopId, itemId, editing, adding, allSuppliers, linkedIds, upsertFn, onDone,
}: {
  shopId: string; itemId: string | null; editing: any | null; adding: boolean;
  allSuppliers: any[]; linkedIds: Set<string>;
  upsertFn: any; onDone: () => void;
}) {
  const open = !!editing || adding;
  const [form, setForm] = useState<any>(() => defaultForm(editing));

  // Reset when opened for a new row
  useMemo(() => { setForm(defaultForm(editing)); }, [editing, adding]);

  const upsert = useMutation({
    mutationFn: (v: any) => upsertFn({ data: v }),
    onSuccess: () => { toast.success(editing ? "Mis à jour" : "Ajouté"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!itemId) return null;

  return (
    <DialogShell
      open={open}
      onOpenChange={(v) => { if (!v) onDone(); }}
      title={editing ? "Modifier le fournisseur" : "Ajouter un fournisseur"}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.supplier_id) { toast.error("Sélectionnez un fournisseur"); return; }
          upsert.mutate({
            shopId,
            id: editing?.id,
            stock_item_id: itemId,
            supplier_id: form.supplier_id,
            supplier_product_reference: form.reference || null,
            supplier_product_name: form.supplier_name || null,
            purchase_price_cents: toCents(form.price),
            tax_rate: Number(form.tax_rate) || 20,
            min_order_qty: Number(form.min_order_qty) || 1,
            pack_qty: Number(form.pack_qty) || 1,
            estimated_delivery_days: form.delivery_days === "" ? null : Number(form.delivery_days),
            shipping_cost_cents: toCents(form.shipping),
            is_primary: !!form.is_primary,
            active: !!form.active,
            notes: form.notes || null,
          });
        }}
        className="space-y-3"
      >
        <Field label="Fournisseur">
          <Select
            value={form.supplier_id}
            onValueChange={(v) => setForm((f: any) => ({ ...f, supplier_id: v }))}
            disabled={!!editing}
          >
            <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>
              {allSuppliers
                .filter((s) => !linkedIds.has(s.id) || (editing && s.id === editing.supplier_id))
                .map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Référence fournisseur">
            <Input value={form.reference} onChange={(e) => setForm((f: any) => ({ ...f, reference: e.target.value }))} />
          </Field>
          <Field label="Nom (fournisseur)">
            <Input value={form.supplier_name} onChange={(e) => setForm((f: any) => ({ ...f, supplier_name: e.target.value }))} />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Prix HT (€)">
            <Input inputMode="decimal" value={form.price} onChange={(e) => setForm((f: any) => ({ ...f, price: e.target.value }))} />
          </Field>
          <Field label="TVA (%)">
            <Input inputMode="decimal" value={form.tax_rate} onChange={(e) => setForm((f: any) => ({ ...f, tax_rate: e.target.value }))} />
          </Field>
          <Field label="Délai (jours)">
            <Input inputMode="numeric" value={form.delivery_days} onChange={(e) => setForm((f: any) => ({ ...f, delivery_days: e.target.value }))} />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Quantité min.">
            <Input inputMode="decimal" value={form.min_order_qty} onChange={(e) => setForm((f: any) => ({ ...f, min_order_qty: e.target.value }))} />
          </Field>
          <Field label="Conditionnement">
            <Input inputMode="decimal" value={form.pack_qty} onChange={(e) => setForm((f: any) => ({ ...f, pack_qty: e.target.value }))} />
          </Field>
          <Field label="Frais livraison (€)">
            <Input inputMode="decimal" value={form.shipping} onChange={(e) => setForm((f: any) => ({ ...f, shipping: e.target.value }))} />
          </Field>
        </div>


        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.is_primary} onCheckedChange={(v) => setForm((f: any) => ({ ...f, is_primary: v }))} />
            Fournisseur principal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={!!form.active} onCheckedChange={(v) => setForm((f: any) => ({ ...f, active: v }))} />
            Actif
          </label>
        </div>

        <FormActions>
          <Button type="button" variant="ghost" onClick={onDone}>Annuler</Button>
          <Button type="submit" disabled={upsert.isPending}>
            {editing ? "Enregistrer" : "Ajouter"}
          </Button>
        </FormActions>
      </form>
    </DialogShell>
  );
}

function defaultForm(editing: any | null) {
  return {
    supplier_id: editing?.supplier_id ?? "",
    reference: editing?.supplier_product_reference ?? "",
    supplier_name: editing?.supplier_product_name ?? "",
    price: editing ? String(fromCents(editing.purchase_price_cents)) : "",
    tax_rate: editing ? String(editing.tax_rate) : "20",
    delivery_days: editing?.estimated_delivery_days ?? "",
    min_order_qty: editing ? String(editing.min_order_qty) : "1",
    pack_qty: editing ? String(editing.pack_qty) : "1",
    shipping: editing ? String(fromCents(editing.shipping_cost_cents)) : "",
    is_primary: editing?.is_primary ?? false,
    active: editing?.active ?? true,
    notes: editing?.notes ?? "",
  };
}