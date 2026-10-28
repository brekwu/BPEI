import { createFileRoute } from "@tanstack/react-router";
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
  listSuppliers, upsertSupplier, archiveSupplier,
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder,
  updatePurchaseOrderStatus, deletePurchaseOrder,
  purchasingStats, sendPurchaseOrder, listPurchaseOrderStatusHistory,
  getPurchaseOrderPdf,
} from "@/lib/purchasing.functions";
import { listStockItems } from "@/lib/stock.functions";
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
import { SupplierComparator } from "@/components/shop/SupplierComparator";
import { SmartReceiveDialog } from "@/components/shop/SmartReceiveDialog";
import { VarianceCloseDialog } from "@/components/shop/VarianceCloseDialog";
import {
  Truck, ShoppingCart, Plus, Archive, RotateCcw, Trash2, Pencil,
  Package, PackageCheck, Send, XCircle, Euro, Users, GitCompare, History, AlertOctagon,
  FileDown, Copy, Mail, Printer,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/purchasing/")({
  head: () => ({
    meta: [
      { title: "Commandes fournisseurs — BPEI" },
      { name: "description", content: "Gestion des fournisseurs et des bons de commande, avec réception automatique en stock." },
    ],
  }),
  component: PurchasingPage,
});

type Supplier = {
  id: string; name: string; contact_name: string | null; email: string | null;
  phone: string | null; website: string | null; address: string | null;
  vat_number: string | null; payment_terms: string | null;
  default_lead_days: number | null; notes: string | null;
  active: boolean; archived_at: string | null;
};

type POStatus = "draft" | "sent" | "confirmed" | "partial" | "late" | "received" | "cancelled" | "closed_variance";
const PO_STATUS_LABEL: Record<POStatus, { label: string; tone: "muted" | "info" | "warning" | "success" | "destructive" }> = {
  draft: { label: "Brouillon", tone: "muted" },
  sent: { label: "Envoyé", tone: "info" },
  confirmed: { label: "Confirmé", tone: "info" },
  partial: { label: "Partiel", tone: "warning" },
  late: { label: "En retard", tone: "warning" },
  received: { label: "Reçu", tone: "success" },
  cancelled: { label: "Annulé", tone: "destructive" },
  closed_variance: { label: "Clôturé (écart)", tone: "destructive" },
};

function PurchasingPage() {
  const ctx = useShop();
  const canManage = canManageShop(ctx.role);
  const [tab, setTab] = useState<"orders" | "suppliers">("orders");

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Commandes fournisseurs"
        description="Bons de commande, réception en stock et gestion des fournisseurs."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <a href={`/app/shop/${ctx.shopId}/purchasing/dashboard`}>
                <Euro className="mr-2 h-4 w-4" />Tableau de bord
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={`/app/shop/${ctx.shopId}/purchasing/restock`}>
                <Package className="mr-2 h-4 w-4" />Réapprovisionnement
              </a>
            </Button>
          </div>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="orders"><ShoppingCart className="mr-2 h-4 w-4" />Bons de commande</TabsTrigger>
          <TabsTrigger value="suppliers"><Truck className="mr-2 h-4 w-4" />Fournisseurs</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><OrdersTab canManage={canManage} /></TabsContent>
        <TabsContent value="suppliers"><SuppliersTab canManage={canManage} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

/* ────────────── BONS DE COMMANDE ────────────── */
function OrdersTab({ canManage }: { canManage: boolean }) {
  const ctx = useShop();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"all" | POStatus>("all");
  const [creating, setCreating] = useState(false);
  const [openPO, setOpenPO] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const listFn = useServerFn(listPurchaseOrders);
  const statsFn = useServerFn(purchasingStats);
  const delFn = useServerFn(deletePurchaseOrder);

  const q = useQuery({
    queryKey: ["po", ctx.shopId, statusFilter],
    queryFn: () => listFn({ data: { shopId: ctx.shopId, ...(statusFilter !== "all" ? { status: statusFilter } : {}) } }),
  });
  const s = useQuery({
    queryKey: ["po-stats", ctx.shopId],
    queryFn: () => statsFn({ data: { shopId: ctx.shopId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["po", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["po-stats", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["stock-items", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["stock-stats", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["stock-movements", ctx.shopId] });
  };

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { shopId: ctx.shopId, id } }),
    onSuccess: () => { invalidate(); setToDelete(null); toast.success("Bon supprimé"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (q.data ?? []) as any[];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bons ouverts" value={s.data?.open ?? "—"} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="Partiellement reçus" value={s.data?.partial ?? "—"} icon={<Package className="h-4 w-4" />} />
        <StatCard label="Fournisseurs actifs" value={s.data?.suppliers ?? "—"} icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Valeur commandée" value={s.data ? formatMoney(s.data.monthValueCents) : "—"} icon={<Euro className="h-4 w-4" />} />
      </div>

      <SectionCard>
        <DataTableShell
          toolbar={
            <>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {Object.entries(PO_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {canManage && (
                <Button size="sm" onClick={() => setCreating(true)} className="ml-auto bg-electric text-electric-foreground hover:bg-electric/90">
                  <Plus className="mr-2 h-4 w-4" />Nouveau bon
                </Button>
              )}
            </>
          }
          loading={q.isLoading}
          empty={!q.isLoading && rows.length === 0}
          emptyIcon={<ShoppingCart className="h-6 w-6" />}
          emptyTitle="Aucun bon de commande"
          emptyDescription="Créez un premier bon de commande pour réappro. La réception ajoute automatiquement le stock."
          emptyAction={canManage ? <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Nouveau bon</Button> : null}
        >
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Référence</th>
                <th className="px-4 py-3 font-medium">Fournisseur</th>
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 font-medium">Prévu</th>
                <th className="px-4 py-3 font-medium text-right">HT</th>
                <th className="px-4 py-3 font-medium text-right">TTC</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const st = PO_STATUS_LABEL[r.status as POStatus];
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{r.reference}</td>
                    <td className="px-4 py-3">{r.supplier?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.order_date)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.expected_date)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatMoney(r.total_ht_cents)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(r.total_ttc_cents)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} label={st?.label} tone={st?.tone} size="sm" /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setOpenPO(r.id)}>Ouvrir</Button>
                        {canManage && (r.status === "draft" || r.status === "cancelled") && (
                          <Button size="icon" variant="ghost" onClick={() => setToDelete(r)} aria-label="Supprimer">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      {creating && (
        <NewPurchaseOrderDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => { invalidate(); setCreating(false); setOpenPO(id); }}
        />
      )}
      {openPO && (
        <PODetailDialog
          poId={openPO}
          canManage={canManage}
          onClose={() => setOpenPO(null)}
          onChanged={invalidate}
        />
      )}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le bon {toDelete?.reference} ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible. Le bon et ses lignes seront effacés.</AlertDialogDescription>
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

/* ────────────── DIALOG CRÉATION BON ────────────── */
type NewLine = {
  key: string;
  item_id: string | null;
  name: string;
  sku: string | null;
  quantity: string;
  unit_price: string;
  tax_rate: string;
};

function newLine(): NewLine {
  return { key: crypto.randomUUID(), item_id: null, name: "", sku: null, quantity: "1", unit_price: "0", tax_rate: "20" };
}

function NewPurchaseOrderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const ctx = useShop();
  const [supplierId, setSupplierId] = useState<string>("");
  const [expected, setExpected] = useState<string>("");
  const [supplierRef, setSupplierRef] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<NewLine[]>([newLine()]);
  const [busy, setBusy] = useState(false);
  const [compareIdx, setCompareIdx] = useState<number | null>(null);

  const listSuppliersFn = useServerFn(listSuppliers);
  const listItemsFn = useServerFn(listStockItems);
  const createFn = useServerFn(createPurchaseOrder);

  const suppliersQ = useQuery({
    queryKey: ["suppliers-active", ctx.shopId],
    queryFn: () => listSuppliersFn({ data: { shopId: ctx.shopId } }),
  });
  const itemsQ = useQuery({
    queryKey: ["stock-items-picker", ctx.shopId],
    queryFn: () => listItemsFn({ data: { shopId: ctx.shopId } }),
  });

  const suppliers = ((suppliersQ.data ?? []) as Supplier[]).filter((s) => s.active);
  const items = (itemsQ.data ?? []) as any[];

  const totals = useMemo(() => {
    let ht = 0, ttc = 0;
    for (const l of lines) {
      const q = parseFloat(l.quantity) || 0;
      const p = toCents(l.unit_price);
      const t = parseFloat(l.tax_rate) || 0;
      const lineHt = q * p;
      ht += lineHt;
      ttc += lineHt * (1 + t / 100);
    }
    return { ht: Math.round(ht), ttc: Math.round(ttc) };
  }, [lines]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) { toast.error("Choisissez un fournisseur"); return; }
    if (lines.length === 0 || lines.some((l) => !l.name.trim() || !(parseFloat(l.quantity) > 0))) {
      toast.error("Chaque ligne doit avoir un nom et une quantité > 0"); return;
    }
    setBusy(true);
    try {
      const po = await createFn({ data: {
        shopId: ctx.shopId,
        supplier_id: supplierId,
        expected_date: expected || null,
        supplier_reference: supplierRef || null,
        notes: notes || null,
        lines: lines.map((l) => ({
          item_id: l.item_id,
          name: l.name.trim(),
          sku: l.sku,
          quantity: parseFloat(l.quantity),
          unit_price_cents: toCents(l.unit_price),
          tax_rate: parseFloat(l.tax_rate),
        })),
      } });
      toast.success(`Bon ${po.reference} créé`);
      onCreated(po.id);
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const pickItem = (idx: number, itemId: string) => {
    const it = items.find((i) => i.id === itemId);
    setLines((ls) => ls.map((l, i) => i === idx ? {
      ...l,
      item_id: itemId,
      name: it?.name ?? l.name,
      sku: it?.sku ?? l.sku,
      unit_price: it?.cost_price_cents != null ? (it.cost_price_cents / 100).toString() : l.unit_price,
      tax_rate: it?.tax_rate != null ? String(it.tax_rate) : l.tax_rate,
    } : l));
  };

  const compareLine = compareIdx != null ? lines[compareIdx] : null;

  return (
    <>
    <DialogShell open onOpenChange={(o) => !o && onClose()} title="Nouveau bon de commande" size="xl">
      <form onSubmit={submit} className="space-y-4">
        <FormRow>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="po-supplier">Fournisseur *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger id="po-supplier"><SelectValue placeholder={suppliers.length === 0 ? "Créez d'abord un fournisseur" : "Choisir…"} /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="po-expected">Livraison prévue</Label>
            <Input id="po-expected" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
        </FormRow>
        <FormRow>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="po-supref">Réf. fournisseur</Label>
            <Input id="po-supref" value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} />
          </div>
        </FormRow>
        <div className="space-y-1.5">
          <Label htmlFor="po-notes">Notes</Label>
          <Textarea id="po-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Article / description</th>
                <th className="px-3 py-2 font-medium w-24 text-right">Qté</th>
                <th className="px-3 py-2 font-medium w-32 text-right">PU HT</th>
                <th className="px-3 py-2 font-medium w-20 text-right">TVA</th>
                <th className="px-3 py-2 font-medium w-32 text-right">Total HT</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l, idx) => {
                const q = parseFloat(l.quantity) || 0;
                const p = toCents(l.unit_price);
                const tot = q * p;
                return (
                  <tr key={l.key}>
                    <td className="px-3 py-2">
                      <Select value={l.item_id ?? "__manual"} onValueChange={(v) => v === "__manual" ? setLines((ls) => ls.map((x, i) => i === idx ? { ...x, item_id: null } : x)) : pickItem(idx, v)}>
                        <SelectTrigger className="h-8 mb-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__manual">Ligne libre</SelectItem>
                          {items.map((it) => <SelectItem key={it.id} value={it.id}>{it.name} {it.sku ? `(${it.sku})` : ""}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input value={l.name} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} placeholder="Description" className="h-8" />
                    </td>
                    <td className="px-3 py-2">
                      <Input inputMode="decimal" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} className="h-8 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2">
                      <Input inputMode="decimal" value={l.unit_price} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))} className="h-8 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2">
                      <Input inputMode="decimal" value={l.tax_rate} onChange={(e) => setLines((ls) => ls.map((x, i) => i === idx ? { ...x, tax_rate: e.target.value } : x))} className="h-8 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatMoney(Math.round(tot))}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {l.item_id && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => setCompareIdx(idx)} aria-label="Comparer fournisseurs" title="Comparer les fournisseurs de cet article">
                            <GitCompare className="h-4 w-4" />
                          </Button>
                        )}
                        {lines.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} aria-label="Supprimer ligne">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/40">
              <tr>
                <td colSpan={4} className="px-3 py-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setLines((ls) => [...ls, newLine()])}>
                    <Plus className="mr-1 h-3.5 w-3.5" />Ajouter une ligne
                  </Button>
                </td>
                <td className="px-3 py-2 text-right text-xs">
                  <div className="text-muted-foreground">HT&nbsp;: <span className="tabular-nums font-medium text-foreground">{formatMoney(totals.ht)}</span></div>
                  <div className="text-muted-foreground">TTC&nbsp;: <span className="tabular-nums font-medium text-foreground">{formatMoney(totals.ttc)}</span></div>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={busy || !supplierId} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {busy ? "Création…" : "Créer le bon"}
          </Button>
        </FormActions>
      </form>
    </DialogShell>
    {compareLine?.item_id && (
      <SupplierComparator
        open={compareIdx != null}
        onClose={() => setCompareIdx(null)}
        shopId={ctx.shopId}
        itemId={compareLine.item_id}
        itemName={compareLine.name}
        onSelect={(row) => {
          if (compareIdx == null) return;
          const idx = compareIdx;
          setLines((ls) => ls.map((x, i) => i === idx ? {
            ...x,
            unit_price: (row.purchase_price_cents / 100).toString(),
            tax_rate: String(row.tax_rate),
          } : x));
          if (row.supplier_id && supplierId && row.supplier_id !== supplierId) {
            toast.info("Fournisseur choisi différent du fournisseur du bon. Le bon reste sur le fournisseur d'origine — créez un bon dédié si nécessaire.");
          } else if (row.supplier_id && !supplierId) {
            setSupplierId(row.supplier_id);
          }
        }}
      />
    )}
    </>
  );
}

/* ────────────── DÉTAIL BON ────────────── */
function PODetailDialog({ poId, canManage, onClose, onChanged }: {
  poId: string; canManage: boolean; onClose: () => void; onChanged: () => void;
}) {
  const ctx = useShop();
  const qc = useQueryClient();
  const getFn = useServerFn(getPurchaseOrder);
  const statusFn = useServerFn(updatePurchaseOrderStatus);
  const sendFn = useServerFn(sendPurchaseOrder);
  const historyFn = useServerFn(listPurchaseOrderStatusHistory);
  const pdfFn = useServerFn(getPurchaseOrderPdf);
  const [smartOpen, setSmartOpen] = useState(false);
  const [varOpen, setVarOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const q = useQuery({
    queryKey: ["po", ctx.shopId, poId],
    queryFn: () => getFn({ data: { shopId: ctx.shopId, id: poId } }),
  });
  const po: any = q.data;
  const st = po ? PO_STATUS_LABEL[po.status as POStatus] : null;
  const hist = useQuery({
    queryKey: ["po-history", ctx.shopId, poId],
    queryFn: () => historyFn({ data: { shopId: ctx.shopId, id: poId } }),
    enabled: showHistory,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["po", ctx.shopId, poId] });
    qc.invalidateQueries({ queryKey: ["po-history", ctx.shopId, poId] });
    onChanged();
  };

  const setStatus = useMutation({
    mutationFn: (status: POStatus) => statusFn({ data: { shopId: ctx.shopId, id: poId, status } }),
    onSuccess: () => { refresh(); toast.success("Statut mis à jour"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const send = useMutation({
    mutationFn: () => sendFn({ data: { shopId: ctx.shopId, id: poId } }),
    onSuccess: () => { refresh(); toast.success("Bon envoyé (snapshot figé)"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const buildPdfBlob = async () => {
    const { base64, filename } = await pdfFn({ data: { shopId: ctx.shopId, id: poId } });
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { blob: new Blob([bytes], { type: "application/pdf" }), filename };
  };

  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      const { blob, filename } = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error((e as Error).message); }
    finally { setPdfLoading(false); }
  };
  const printPdf = async () => {
    setPdfLoading(true);
    try {
      const { blob } = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) {
        setTimeout(() => { try { w.focus(); w.print(); } catch { /* ignore */ } }, 400);
        // Révoquer l'URL après ouverture (le PDF reste chargé dans l'onglet)
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        URL.revokeObjectURL(url);
        toast.error("Impossible d'ouvrir la fenêtre d'impression (pop-up bloqué).");
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setPdfLoading(false); }
  };
  const copySummary = async () => {
    if (!po) return;
    const lines = (po.lines ?? []).map((l: any, i: number) =>
      `${i + 1}. ${l.name}${l.sku ? ` (${l.sku})` : ""} — ${l.quantity}${l.unit ? ` ${l.unit}` : ""} × ${formatMoney(l.unit_price_cents)}`
    ).join("\n");
    const txt = [
      `Bon de commande ${po.reference}`,
      `Fournisseur : ${po.supplier?.name ?? "—"}`,
      po.expected_date ? `Livraison souhaitée : ${fmtDate(po.expected_date)}` : null,
      "",
      lines || "(aucune ligne)",
      "",
      `Total HT : ${formatMoney(po.total_ht_cents)} · Total TTC : ${formatMoney(po.total_ttc_cents)}`,
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Résumé copié dans le presse-papier");
    } catch { toast.error("Copie impossible"); }
  };
  const openEmail = () => {
    if (!po) return;
    const to = po.supplier?.email ?? "";
    const subject = `Bon de commande ${po.reference}`;
    const body = [
      `Bonjour${po.supplier?.contact_name ? ` ${po.supplier.contact_name}` : ""},`,
      "",
      `Veuillez trouver ci-joint notre bon de commande ${po.reference}.`,
      po.expected_date ? `Livraison souhaitée : ${fmtDate(po.expected_date)}.` : "",
      "",
      `Total HT : ${formatMoney(po.total_ht_cents)} — Total TTC : ${formatMoney(po.total_ttc_cents)}.`,
      "",
      "Merci de nous confirmer la bonne réception de cette commande.",
      "",
      "Cordialement,",
    ].filter(Boolean).join("\n");
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };


  const receivable = po && ["sent","confirmed","partial","late"].includes(po.status);
  const closable = po && ["sent","confirmed","partial","late"].includes(po.status);
  const anyPartial = po?.lines?.some((l: any) => Number(l.received_quantity) > 0);

  return (
    <>
    <DialogShell
      open
      onOpenChange={(o) => !o && onClose()}
      title={po ? `${po.reference} — ${po.supplier?.name ?? ""}` : "Chargement…"}
      description={po ? `Commande du ${fmtDate(po.order_date)}${po.expected_date ? ` · livraison prévue ${fmtDate(po.expected_date)}` : ""}` : ""}
      size="xl"
      footer={po && canManage && (
        <div className="flex flex-wrap items-center gap-2 w-full">
          {po.status === "draft" && (
            <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending}>
              <Send className="mr-1 h-3.5 w-3.5" />{send.isPending ? "Envoi…" : "Envoyer au fournisseur"}
            </Button>
          )}
          {receivable && (
            <Button size="sm" onClick={() => setSmartOpen(true)} className="bg-electric text-electric-foreground hover:bg-electric/90">
              <PackageCheck className="mr-1 h-3.5 w-3.5" />Réception intelligente
            </Button>
          )}
          {closable && anyPartial && (
            <Button size="sm" variant="outline" onClick={() => setVarOpen(true)}>
              <AlertOctagon className="mr-1 h-3.5 w-3.5" />Clôturer avec écart
            </Button>
          )}
          {(po.status === "draft" || po.status === "sent" || po.status === "confirmed") && (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("cancelled")}>
              <XCircle className="mr-1 h-3.5 w-3.5" />Annuler le bon
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={downloadPdf} disabled={pdfLoading}>
            <FileDown className="mr-1 h-3.5 w-3.5" />{pdfLoading ? "PDF…" : "PDF"}
          </Button>
          <Button size="sm" variant="ghost" onClick={printPdf} disabled={pdfLoading}>
            <Printer className="mr-1 h-3.5 w-3.5" />Imprimer
          </Button>
          <Button size="sm" variant="ghost" onClick={copySummary}>
            <Copy className="mr-1 h-3.5 w-3.5" />Copier résumé
          </Button>
          <Button size="sm" variant="ghost" onClick={openEmail}>
            <Mail className="mr-1 h-3.5 w-3.5" />E-mail
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowHistory((s) => !s)}>
            <History className="mr-1 h-3.5 w-3.5" />{showHistory ? "Masquer" : "Historique"}
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            HT&nbsp;: <span className="tabular-nums font-medium text-foreground">{formatMoney(po.total_ht_cents)}</span> ·
            TTC&nbsp;: <span className="tabular-nums font-medium text-foreground">{formatMoney(po.total_ttc_cents)}</span>
          </div>
        </div>
      )}
    >
      {!po ? <p className="text-sm text-muted-foreground">Chargement…</p> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge status={po.status} label={st?.label} tone={st?.tone} />
            {po.supplier_reference && <span className="text-muted-foreground">Réf. fournisseur : <b>{po.supplier_reference}</b></span>}
            {po.delivery_note_reference && <span className="text-muted-foreground">BL : <b>{po.delivery_note_reference}</b></span>}
            {po.sent_at && <span className="text-muted-foreground">Envoyé le {fmtDate(po.sent_at)}</span>}
          </div>
          {po.status === "closed_variance" && (po.variance_reason || po.variance_note) && (
            <div className="border border-destructive/40 bg-destructive/5 rounded-md p-3 text-sm">
              <div className="font-medium text-destructive">Clôturé avec écart</div>
              {po.variance_reason && <div className="text-muted-foreground">Motif : {po.variance_reason}</div>}
              {po.variance_note && <div className="text-muted-foreground whitespace-pre-line">{po.variance_note}</div>}
            </div>
          )}
          {po.notes && <p className="text-sm text-muted-foreground whitespace-pre-line">{po.notes}</p>}
          {!po.supplier?.email && (
            <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-xs text-muted-foreground">
              Aucun e-mail configuré pour ce fournisseur. Le bouton « E-mail » ouvrira votre client de messagerie avec un modèle prêt à personnaliser — pensez à joindre le PDF téléchargé.
            </div>
          )}


          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Article</th>
                  <th className="px-3 py-2 font-medium text-right">Cmdé</th>
                  <th className="px-3 py-2 font-medium text-right">Reçu</th>
                  <th className="px-3 py-2 font-medium text-right">Endom.</th>
                  <th className="px-3 py-2 font-medium text-right">Reste</th>
                  <th className="px-3 py-2 font-medium text-right">PU HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(po.lines ?? []).map((l: any) => {
                  const remain = Number(l.quantity) - Number(l.received_quantity);
                  return (
                    <tr key={l.id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{l.name}</div>
                        {l.sku && <div className="text-xs text-muted-foreground">{l.sku}</div>}
                        {!l.item_id && <div className="text-xs text-warning">Non lié à un article de stock</div>}
                        {l.reception_notes && (
                          <div className="text-xs text-muted-foreground whitespace-pre-line mt-1 border-l-2 border-border pl-2">
                            {l.reception_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtQty(Number(l.quantity))}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtQty(Number(l.received_quantity))}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtQty(Number(l.damaged_quantity ?? 0))}</td>
                      <td className={`px-3 py-2 text-right tabular-nums font-medium ${remain > 0 ? "text-warning" : "text-success"}`}>{fmtQty(remain)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatMoney(l.unit_price_cents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showHistory && (
            <div className="border border-border rounded-md p-3 space-y-1.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">Historique des statuts</div>
              {hist.isLoading && <div className="text-sm text-muted-foreground">Chargement…</div>}
              {!hist.isLoading && (hist.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">Aucun changement.</div>}
              {(hist.data ?? []).map((h: any) => (
                <div key={h.id} className="text-xs flex items-start gap-2">
                  <span className="text-muted-foreground tabular-nums w-32 shrink-0">{new Date(h.changed_at).toLocaleString("fr-FR")}</span>
                  <span>
                    {h.old_status ? <><b>{PO_STATUS_LABEL[h.old_status as POStatus]?.label ?? h.old_status}</b> → </> : "Créé en "}
                    <b>{PO_STATUS_LABEL[h.new_status as POStatus]?.label ?? h.new_status}</b>
                    {h.reason && <span className="text-muted-foreground"> · {h.reason}</span>}
                    {h.note && <div className="text-muted-foreground whitespace-pre-line">{h.note}</div>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DialogShell>
    {po && smartOpen && (
      <SmartReceiveDialog
        open={smartOpen}
        onClose={() => setSmartOpen(false)}
        shopId={ctx.shopId}
        poId={poId}
        lines={po.lines ?? []}
        onDone={refresh}
      />
    )}
    {po && varOpen && (
      <VarianceCloseDialog
        open={varOpen}
        onClose={() => setVarOpen(false)}
        shopId={ctx.shopId}
        poId={poId}
        poRef={po.reference}
        onDone={refresh}
      />
    )}
    </>
  );
}

/* ────────────── FOURNISSEURS ────────────── */
function SuppliersTab({ canManage }: { canManage: boolean }) {
  const ctx = useShop();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const dq = useDebouncedValue(search, 300);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);

  const listFn = useServerFn(listSuppliers);
  const upsertFn = useServerFn(upsertSupplier);
  const archiveFn = useServerFn(archiveSupplier);

  const q = useQuery({
    queryKey: ["suppliers", ctx.shopId, includeArchived],
    queryFn: () => listFn({ data: { shopId: ctx.shopId, includeArchived } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["suppliers", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["suppliers-active", ctx.shopId] });
    qc.invalidateQueries({ queryKey: ["po-stats", ctx.shopId] });
  };

  const archive = useMutation({
    mutationFn: (v: { id: string; restore?: boolean }) => archiveFn({ data: { shopId: ctx.shopId, ...v } }),
    onSuccess: (_, v) => { invalidate(); toast.success(v.restore ? "Restauré" : "Archivé"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (q.data ?? []) as Supplier[];
  const filtered = useMemo(() => {
    const n = dq.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => [r.name, r.contact_name, r.email, r.phone].filter(Boolean).join(" ").toLowerCase().includes(n));
  }, [rows, dq]);

  return (
    <div className="space-y-4">
      <SectionCard>
        <DataTableShell
          toolbar={
            <>
              <Input placeholder="Rechercher (nom, contact, email)…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm h-9" aria-label="Rechercher un fournisseur" />
              <label className="flex items-center gap-2 text-sm ml-auto">
                <Switch checked={includeArchived} onCheckedChange={setIncludeArchived} />
                Archivés
              </label>
              {canManage && (
                <Button size="sm" onClick={() => setEditing({})} className="bg-electric text-electric-foreground hover:bg-electric/90">
                  <Plus className="mr-2 h-4 w-4" />Nouveau fournisseur
                </Button>
              )}
            </>
          }
          loading={q.isLoading}
          empty={!q.isLoading && filtered.length === 0}
          emptyIcon={<Truck className="h-6 w-6" />}
          emptyTitle="Aucun fournisseur"
          emptyDescription={rows.length === 0 ? "Créez un fournisseur pour passer votre premier bon de commande." : "Aucun résultat."}
          emptyAction={canManage && rows.length === 0 ? <Button onClick={() => setEditing({})}><Plus className="mr-2 h-4 w-4" />Nouveau fournisseur</Button> : null}
          footer={<span>{filtered.length} fournisseur{filtered.length > 1 ? "s" : ""}</span>}
        >
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">État</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const state = r.archived_at
                  ? { status: "archived", label: "Archivé", tone: "muted" as const }
                  : r.active
                  ? { status: "active", label: "Actif", tone: "success" as const }
                  : { status: "inactive", label: "Désactivé", tone: "warning" as const };
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      {r.website && <div className="text-xs text-muted-foreground">{r.website}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.contact_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={state.status} label={state.label} tone={state.tone} size="sm" /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                          <a href={`/app/shop/${ctx.shopId}/purchasing/suppliers/${r.id}`}>Fiche</a>
                        </Button>
                        {canManage && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => setEditing(r)} aria-label="Modifier"><Pencil className="h-4 w-4" /></Button>
                            {r.archived_at ? (
                              <Button size="icon" variant="ghost" onClick={() => archive.mutate({ id: r.id, restore: true })} aria-label="Restaurer">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" onClick={() => archive.mutate({ id: r.id })} aria-label="Archiver">
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
        <SupplierDialog
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
    </div>
  );
}

const SupplierFormZ = z.object({
  name: z.string().min(1, "Nom requis").max(200),
  contact_name: z.string().max(120).optional().or(z.literal("")),
  email: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  website: z.string().max(300).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  vat_number: z.string().max(40).optional().or(z.literal("")),
  payment_terms: z.string().max(120).optional().or(z.literal("")),
  default_lead_days: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  active: z.boolean(),
});
type SupplierFormV = z.infer<typeof SupplierFormZ>;

function SupplierDialog({ initial, onClose, onSubmit }: {
  initial: Partial<Supplier>; onClose: () => void; onSubmit: (v: any) => Promise<void>;
}) {
  const isNew = !initial.id;
  const form = useForm<SupplierFormV>({
    resolver: zodResolver(SupplierFormZ),
    defaultValues: {
      name: initial.name ?? "",
      contact_name: initial.contact_name ?? "",
      email: initial.email ?? "",
      phone: initial.phone ?? "",
      website: initial.website ?? "",
      address: initial.address ?? "",
      vat_number: initial.vat_number ?? "",
      payment_terms: initial.payment_terms ?? "",
      default_lead_days: initial.default_lead_days != null ? String(initial.default_lead_days) : "",
      notes: initial.notes ?? "",
      active: initial.active ?? true,
    },
  });
  const [busy, setBusy] = useState(false);

  return (
    <DialogShell open onOpenChange={(o) => !o && onClose()}
      title={isNew ? "Nouveau fournisseur" : "Modifier le fournisseur"} size="lg">
      <form
        id="supplier-form"
        onSubmit={form.handleSubmit(async (v) => {
          setBusy(true);
          try {
            await onSubmit({
              name: v.name.trim(),
              contact_name: v.contact_name?.trim() || null,
              email: v.email?.trim() || null,
              phone: v.phone?.trim() || null,
              website: v.website?.trim() || null,
              address: v.address?.trim() || null,
              vat_number: v.vat_number?.trim() || null,
              payment_terms: v.payment_terms?.trim() || null,
              default_lead_days: v.default_lead_days?.trim() ? parseInt(v.default_lead_days) : null,
              notes: v.notes?.trim() || null,
              active: v.active,
            });
          } finally { setBusy(false); }
        })}
        className="space-y-4"
      >
        <FormRow>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="s-name">Nom *</Label>
            <Input id="s-name" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-contact">Contact</Label>
            <Input id="s-contact" {...form.register("contact_name")} />
          </div>
        </FormRow>
        <FormRow>
          <div className="space-y-1.5"><Label htmlFor="s-email">Email</Label><Input id="s-email" type="email" {...form.register("email")} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-phone">Téléphone</Label><Input id="s-phone" {...form.register("phone")} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-web">Site web</Label><Input id="s-web" {...form.register("website")} /></div>
        </FormRow>
        <FormRow>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-addr">Adresse</Label><Input id="s-addr" {...form.register("address")} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-vat">N° TVA</Label><Input id="s-vat" {...form.register("vat_number")} /></div>
        </FormRow>
        <FormRow>
          <div className="space-y-1.5"><Label htmlFor="s-terms">Conditions de paiement</Label><Input id="s-terms" {...form.register("payment_terms")} placeholder="30 jours net" /></div>
          <div className="space-y-1.5"><Label htmlFor="s-lead">Délai livraison (jours)</Label><Input id="s-lead" inputMode="numeric" {...form.register("default_lead_days")} /></div>
        </FormRow>
        <div className="space-y-1.5">
          <Label htmlFor="s-notes">Notes</Label>
          <Textarea id="s-notes" rows={3} {...form.register("notes")} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={form.watch("active")} onCheckedChange={(v) => form.setValue("active", v)} />
          Actif
        </label>
        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" form="supplier-form" disabled={busy} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {busy ? "Enregistrement…" : isNew ? "Créer" : "Enregistrer"}
          </Button>
        </FormActions>
      </form>
    </DialogShell>
  );
}

/* ────────────── utils ────────────── */
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-FR"); } catch { return d; }
}
function fmtQty(n: number): string {
  if (!isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}