import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useShop } from "@/components/shop/ShopLayout";
import { canManageShop } from "@/lib/shop-constants";
import { formatMoney } from "@/lib/money";
import {
  restockSuggestions, createPurchaseOrdersFromRestock,
} from "@/lib/restock.functions";
import {
  PageContainer, PageHeader, SectionCard, StatCard, DataTableShell,
  DialogShell,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, PackageX, Zap, Package, ArrowLeft, ShoppingCart, Check,
  GitCompare, Star, Award, Timer,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/purchasing/restock")({
  head: () => ({
    meta: [
      { title: "Réapprovisionnement — BPEI" },
      { name: "description", content: "Suggestions automatiques de réapprovisionnement avec choix du fournisseur." },
    ],
  }),
  component: RestockPage,
});

type SupplierOffer = {
  stock_item_supplier_id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_active: boolean;
  price_cents: number;
  tax_rate: number;
  min_order_qty: number;
  pack_qty: number;
  delivery_days: number | null;
  shipping_cents: number;
  supplier_product_reference: string | null;
  is_primary: boolean;
};

type Suggestion = {
  id: string; name: string; sku: string | null; category: string | null; brand: string | null;
  unit: string; stock: number; reserved: number; available: number; threshold: number;
  on_order: number; consumption_7d: number; consumption_30d: number; consumption_90d: number;
  avg_daily: number; lead_days: number; recommended_qty: number;
  urgency: "critical" | "urgent" | "watch" | "normal";
  primary_supplier: {
    id: string; supplier_id: string; name: string;
    price_cents: number; tax_rate: number; delivery_days: number | null;
    min_order_qty: number; pack_qty: number;
  } | null;
  all_suppliers: SupplierOffer[];
  supplier_count: number; need: boolean;
};

const URGENCY_META = {
  critical: { label: "Rupture",    color: "bg-destructive/10 text-destructive", icon: PackageX },
  urgent:   { label: "Urgent",     color: "bg-warning/10 text-warning-foreground", icon: AlertTriangle },
  watch:    { label: "À surveiller", color: "bg-info/10 text-info-foreground",    icon: Zap },
  normal:   { label: "Normal",     color: "bg-muted text-muted-foreground",     icon: Package },
} as const;

/** Ajuste une quantité à un minimum et un conditionnement fournisseur. */
function normalizeQty(need: number, min: number, pack: number) {
  const q = Math.max(need, min || 1);
  const p = pack || 1;
  return Math.ceil(q / p) * p;
}

function RestockPage() {
  const ctx = useShop();
  const qc = useQueryClient();
  const canManage = canManageShop(ctx.role);
  const navigate = useNavigate();
  const base = `/app/shop/${ctx.shopId}`;

  const [urgencyFilter, setUrgencyFilter] = useState<"all" | Suggestion["urgency"]>("all");
  // selected : itemId → { sisId, qty }
  const [selected, setSelected] = useState<Map<string, { sisId: string; qty: number }>>(new Map());
  const [creating, setCreating] = useState(false);
  const [comparing, setComparing] = useState<Suggestion | null>(null);
  const idempotencyRef = useRef<string>(crypto.randomUUID());

  const listFn = useServerFn(restockSuggestions);
  const createFn = useServerFn(createPurchaseOrdersFromRestock);

  const q = useQuery({
    queryKey: ["restock", ctx.shopId],
    queryFn: () => listFn({ data: { shopId: ctx.shopId } }),
  });

  const rows = (q.data ?? []) as Suggestion[];
  const filtered = urgencyFilter === "all" ? rows : rows.filter((r) => r.urgency === urgencyFilter);

  const stats = useMemo(() => {
    const critical = rows.filter((r) => r.urgency === "critical").length;
    const urgent = rows.filter((r) => r.urgency === "urgent").length;
    const watch = rows.filter((r) => r.urgency === "watch").length;
    const noSupplier = rows.filter((r) => !r.primary_supplier).length;
    return { critical, urgent, watch, noSupplier, total: rows.length };
  }, [rows]);

  const create = useMutation({
    mutationFn: (payload: any) => createFn({ data: payload }),
    onSuccess: (res: any) => {
      const n = res?.created?.length ?? 0;
      toast.success(res?.replayed ? "Déjà généré (protection double-clic)" : `${n} bon(s) de commande créés`);
      qc.invalidateQueries({ queryKey: ["po", ctx.shopId] });
      qc.invalidateQueries({ queryKey: ["po-stats", ctx.shopId] });
      qc.invalidateQueries({ queryKey: ["restock", ctx.shopId] });
      setSelected(new Map());
      setCreating(false);
      idempotencyRef.current = crypto.randomUUID();
      navigate({ to: `${base}/purchasing` });
    },
    onError: (e: Error) => { toast.error(e.message); setCreating(false); },
  });

  function pickSuggestedOffer(r: Suggestion): SupplierOffer | null {
    if (r.all_suppliers.length === 0) return null;
    return r.all_suppliers.find((s) => s.is_primary) ?? r.all_suppliers[0];
  }

  function toggleRow(r: Suggestion, checked: boolean) {
    setSelected((s) => {
      const next = new Map(s);
      if (checked) {
        const offer = pickSuggestedOffer(r);
        if (!offer) return next;
        const qty = normalizeQty(r.recommended_qty || 1, offer.min_order_qty, offer.pack_qty);
        next.set(r.id, { sisId: offer.stock_item_supplier_id, qty });
      } else next.delete(r.id);
      return next;
    });
  }

  function updateQty(id: string, qty: number) {
    setSelected((s) => {
      const cur = s.get(id);
      if (!cur) return s;
      const next = new Map(s);
      next.set(id, { ...cur, qty });
      return next;
    });
  }

  function selectAllUrgent() {
    const next = new Map<string, { sisId: string; qty: number }>();
    rows.filter((r) => r.urgency === "critical" || r.urgency === "urgent")
      .forEach((r) => {
        const offer = pickSuggestedOffer(r);
        if (!offer) return;
        const qty = normalizeQty(r.recommended_qty || 1, offer.min_order_qty, offer.pack_qty);
        next.set(r.id, { sisId: offer.stock_item_supplier_id, qty });
      });
    setSelected(next);
  }

  function chooseOffer(itemId: string, offer: SupplierOffer, baseNeed: number) {
    const qty = normalizeQty(baseNeed || 1, offer.min_order_qty, offer.pack_qty);
    setSelected((s) => {
      const next = new Map(s);
      next.set(itemId, { sisId: offer.stock_item_supplier_id, qty });
      return next;
    });
    setComparing(null);
    toast.success(`Fournisseur ${offer.supplier_name} sélectionné — qté ${qty}`);
  }

  function launch() {
    const selections: any[] = [];
    for (const [id, { sisId, qty }] of selected) {
      const r = rows.find((x) => x.id === id);
      if (!r) continue;
      const offer = r.all_suppliers.find((o) => o.stock_item_supplier_id === sisId);
      if (!offer) continue;
      if (qty <= 0) continue;
      selections.push({
        item_id: r.id,
        supplier_id: offer.supplier_id,
        stock_item_supplier_id: offer.stock_item_supplier_id,
        quantity: qty,
        unit_price_cents: offer.price_cents,
        tax_rate: Number(offer.tax_rate) || 20,
        name: r.name,
        sku: r.sku,
      });
    }
    if (selections.length === 0) {
      toast.error("Sélectionnez au moins un article avec un fournisseur");
      return;
    }
    create.mutate({ shopId: ctx.shopId, selections, idempotencyKey: idempotencyRef.current });
  }

  // regroupement pour aperçu
  const bySupplier = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number }>();
    for (const [id, { sisId, qty }] of selected) {
      const r = rows.find((x) => x.id === id);
      if (!r) continue;
      const offer = r.all_suppliers.find((o) => o.stock_item_supplier_id === sisId);
      if (!offer) continue;
      const cur = m.get(offer.supplier_id) ?? { name: offer.supplier_name, total: 0, count: 0 };
      cur.total += qty * offer.price_cents;
      cur.count += 1;
      m.set(offer.supplier_id, cur);
    }
    return m;
  }, [selected, rows]);
  const selectedTotal = Array.from(bySupplier.values()).reduce((a, b) => a + b.total, 0);

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Achats"
        title="Réapprovisionnement"
        description="Choisissez le fournisseur pour chaque article. La quantité est ajustée au minimum et au conditionnement de l'offre sélectionnée."
        actions={
          <Button variant="outline" asChild>
            <Link to={`${base}/purchasing`}><ArrowLeft className="mr-2 h-4 w-4" />Retour aux achats</Link>
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ruptures" value={stats.critical} icon={<PackageX className="h-4 w-4 text-destructive" />} />
        <StatCard label="Urgents" value={stats.urgent} icon={<AlertTriangle className="h-4 w-4 text-warning" />} />
        <StatCard label="À surveiller" value={stats.watch} icon={<Zap className="h-4 w-4" />} />
        <StatCard label="Sans fournisseur" value={stats.noSupplier} icon={<Package className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <SectionCard>
        <DataTableShell
          toolbar={
            <>
              <Select value={urgencyFilter} onValueChange={(v) => setUrgencyFilter(v as typeof urgencyFilter)}>
                <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes urgences</SelectItem>
                  <SelectItem value="critical">Rupture</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="watch">À surveiller</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={selectAllUrgent}>
                Sélectionner urgents
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  onClick={() => setCreating(true)}
                  disabled={selected.size === 0}
                  className="ml-auto bg-electric text-electric-foreground hover:bg-electric/90"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Générer {bySupplier.size} bon(s) — {formatMoney(selectedTotal)} HT
                </Button>
              )}
            </>
          }
          loading={q.isLoading}
          empty={!q.isLoading && filtered.length === 0}
          emptyIcon={<Check className="h-6 w-6" />}
          emptyTitle="Rien à réapprovisionner"
          emptyDescription="Aucun article n'est en rupture ou sous seuil."
        >
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2"></th>
                <th className="px-3 py-2">Article</th>
                <th className="px-3 py-2">Urgence</th>
                <th className="px-3 py-2 text-right">Dispo</th>
                <th className="px-3 py-2 text-right">Seuil</th>
                <th className="px-3 py-2 text-right">En cmd</th>
                <th className="px-3 py-2">Fournisseur choisi</th>
                <th className="px-3 py-2 text-right">Suggéré</th>
                <th className="px-3 py-2 text-right w-32">Qté commande</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const u = URGENCY_META[r.urgency];
                const UIcon = u.icon;
                const sel = selected.get(r.id);
                const noSupplier = r.all_suppliers.length === 0;
                const chosen = sel ? r.all_suppliers.find((o) => o.stock_item_supplier_id === sel.sisId) : null;
                const displayOffer = chosen ?? pickSuggestedOffer(r);
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={!!sel}
                        onCheckedChange={(v) => toggleRow(r, !!v)}
                        disabled={noSupplier}
                        aria-label={`Sélectionner ${r.name}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[r.sku, r.brand, r.category].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={u.color}>
                        <UIcon className="mr-1 h-3 w-3" />{u.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className={r.available <= 0 ? "text-destructive font-semibold" : ""}>{r.available}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.threshold}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{r.on_order}</td>
                    <td className="px-3 py-2">
                      {noSupplier ? (
                        <span className="text-xs italic text-destructive">Aucun fournisseur</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium truncate">{displayOffer?.supplier_name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {displayOffer && formatMoney(displayOffer.price_cents)} HT · {displayOffer?.delivery_days ?? r.lead_days}j
                              {displayOffer && (displayOffer.min_order_qty > 1 || displayOffer.pack_qty > 1) && (
                                <> · min {displayOffer.min_order_qty} × {displayOffer.pack_qty}</>
                              )}
                            </div>
                          </div>
                          {r.all_suppliers.length > 1 && (
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs shrink-0"
                                    onClick={() => setComparing(r)}>
                              <GitCompare className="h-3 w-3" />Comparer
                            </Button>
                          )}
                          {r.all_suppliers.length === 1 && (
                            <span className="text-[10px] text-muted-foreground shrink-0">seul offre</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold">{r.recommended_qty}</td>
                    <td className="px-3 py-2 text-right">
                      {sel && (
                        <Input
                          type="number"
                          min="1"
                          value={sel.qty}
                          onChange={(e) => updateQty(r.id, Number(e.target.value) || 0)}
                          className="h-8 w-20 text-right font-mono"
                          aria-label={`Quantité ${r.name}`}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </DataTableShell>
      </SectionCard>

      {comparing && (
        <RestockComparatorDialog
          item={comparing}
          currentSisId={selected.get(comparing.id)?.sisId ?? null}
          onCancel={() => setComparing(null)}
          onPick={(offer) => chooseOffer(comparing.id, offer, comparing.recommended_qty)}
        />
      )}

      {creating && (
        <ConfirmCreateDialog
          selections={Array.from(selected.entries()).map(([id, { sisId, qty }]) => {
            const r = rows.find((x) => x.id === id)!;
            const offer = r.all_suppliers.find((o) => o.stock_item_supplier_id === sisId)!;
            return { r, offer, qty };
          })}
          onCancel={() => setCreating(false)}
          onConfirm={launch}
          loading={create.isPending}
        />
      )}
    </PageContainer>
  );
}

/** Comparateur affichant toutes les offres pour un article donné. */
function RestockComparatorDialog({
  item, currentSisId, onCancel, onPick,
}: {
  item: Suggestion;
  currentSisId: string | null;
  onCancel: () => void;
  onPick: (offer: SupplierOffer) => void;
}) {
  const offers = item.all_suppliers.filter((o) => o.supplier_active);
  const cheapest = offers.slice().sort((a, b) => a.price_cents - b.price_cents)[0];
  const fastest = offers.slice().filter((o) => o.delivery_days != null)
    .sort((a, b) => (a.delivery_days! - b.delivery_days!))[0];
  // meilleur compromis : score = prix normalisé + délai normalisé (min = 1)
  const prices = offers.map((o) => o.price_cents).filter((p) => p > 0);
  const delays = offers.map((o) => o.delivery_days).filter((d): d is number => d != null && d > 0);
  const minP = Math.min(...prices, 1);
  const minD = Math.min(...delays, 1);
  const balanced = offers.slice().sort((a, b) => {
    const sa = (a.price_cents / minP) + ((a.delivery_days ?? 30) / minD);
    const sb = (b.price_cents / minP) + ((b.delivery_days ?? 30) / minD);
    return sa - sb;
  })[0];

  return (
    <DialogShell open onOpenChange={(o) => !o && onCancel()} size="lg"
      title={`Fournisseurs — ${item.name}`}
      description="Sélectionnez le fournisseur pour cet article. La quantité sera ajustée au minimum et au conditionnement."
    >
      <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[800px]">
        <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Fournisseur</th>
            <th className="px-3 py-2">Réf.</th>
            <th className="px-3 py-2 text-right">Prix HT</th>
            <th className="px-3 py-2 text-right">TTC</th>
            <th className="px-3 py-2 text-right">Délai</th>
            <th className="px-3 py-2 text-right">Min × pack</th>
            <th className="px-3 py-2 text-right">Frais</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {offers.map((o) => {
            const ttc = Math.round(o.price_cents * (1 + Number(o.tax_rate) / 100));
            const isCurrent = o.stock_item_supplier_id === currentSisId;
            return (
              <tr key={o.stock_item_supplier_id} className={isCurrent ? "bg-electric/5" : ""}>
                <td className="px-3 py-2">
                  <div className="font-medium flex items-center gap-1.5">
                    {o.supplier_name}
                    {o.is_primary && <Badge variant="secondary" className="text-[10px] gap-1"><Star className="h-3 w-3" />principal</Badge>}
                    {cheapest?.stock_item_supplier_id === o.stock_item_supplier_id && (
                      <Badge className="bg-success/10 text-success text-[10px] gap-1"><Award className="h-3 w-3" />moins cher</Badge>
                    )}
                    {fastest?.stock_item_supplier_id === o.stock_item_supplier_id && (
                      <Badge className="bg-info/10 text-info text-[10px] gap-1"><Timer className="h-3 w-3" />plus rapide</Badge>
                    )}
                    {balanced?.stock_item_supplier_id === o.stock_item_supplier_id && (
                      <Badge className="bg-warning/10 text-warning-foreground text-[10px]">compromis</Badge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">{o.supplier_product_reference ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{formatMoney(o.price_cents)}</td>
                <td className="px-3 py-2 text-right font-mono text-muted-foreground">{formatMoney(ttc)}</td>
                <td className="px-3 py-2 text-right font-mono">{o.delivery_days ?? "—"}j</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{o.min_order_qty} × {o.pack_qty}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{o.shipping_cents ? formatMoney(o.shipping_cents) : "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant={isCurrent ? "default" : "outline"} onClick={() => onPick(o)}>
                    {isCurrent ? "Sélectionné" : "Choisir"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <div className="mt-4 text-xs text-muted-foreground">
        L'indication « meilleur compromis » est indicative — le score combine prix et délai normalisés. Confirmez manuellement.
      </div>
    </DialogShell>
  );
}

function ConfirmCreateDialog({
  selections, onCancel, onConfirm, loading,
}: {
  selections: Array<{ r: Suggestion; offer: SupplierOffer; qty: number }>;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const groups = new Map<string, {
    name: string; total_ht: number; total_ttc: number;
    lines: Array<{ name: string; qty: number; price: number; ttc: number; lead: number | null }>;
  }>();
  for (const { r, offer, qty } of selections) {
    const key = offer.supplier_id;
    const g = groups.get(key) ?? { name: offer.supplier_name, total_ht: 0, total_ttc: 0, lines: [] };
    const lineHt = qty * offer.price_cents;
    const lineTtc = Math.round(lineHt * (1 + Number(offer.tax_rate) / 100));
    g.lines.push({ name: r.name, qty, price: offer.price_cents, ttc: lineTtc, lead: offer.delivery_days });
    g.total_ht += lineHt;
    g.total_ttc += lineTtc;
    groups.set(key, g);
  }

  return (
    <DialogShell open onOpenChange={(o) => !o && !loading && onCancel()} size="lg"
      title="Générer les bons de commande"
      description={`${groups.size} fournisseur(s), ${selections.length} ligne(s). Un bon distinct sera créé par fournisseur.`}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>Annuler</Button>
          <Button onClick={onConfirm} disabled={loading} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {loading ? "Création…" : "Confirmer et générer"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([id, g]) => {
          const maxLead = Math.max(0, ...g.lines.map((l) => l.lead ?? 0));
          return (
            <div key={id} className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2">
                <span className="font-medium">{g.name}</span>
                <span className="font-mono text-xs">
                  {formatMoney(g.total_ht)} HT · <b>{formatMoney(g.total_ttc)} TTC</b>
                  {maxLead > 0 && <span className="ml-2 text-muted-foreground">~{maxLead}j</span>}
                </span>
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border">
                  {g.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5">{l.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{l.qty}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{formatMoney(l.price)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">{formatMoney(l.qty * l.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </DialogShell>
  );
}