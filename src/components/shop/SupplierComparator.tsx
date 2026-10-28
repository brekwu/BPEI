import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { listItemSuppliers } from "@/lib/stock-suppliers.functions";
import { DialogShell } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { Star, Zap, TrendingDown, Award, Info } from "lucide-react";

type Row = {
  id: string;
  supplier_id: string;
  supplier_product_reference: string | null;
  purchase_price_cents: number;
  tax_rate: number;
  min_order_qty: number;
  pack_qty: number;
  estimated_delivery_days: number | null;
  shipping_cost_cents: number;
  is_primary: boolean;
  active: boolean;
  last_price_update_at: string | null;
  supplier: { id: string; name: string; email: string | null; phone: string | null; default_lead_days: number | null } | null;
};

export function SupplierComparator({
  open, onClose, shopId, itemId, itemName, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  itemId: string;
  itemName?: string;
  onSelect?: (row: Row) => void;
}) {
  const fn = useServerFn(listItemSuppliers);
  const q = useQuery({
    queryKey: ["item-suppliers", shopId, itemId],
    queryFn: () => fn({ data: { shopId, itemId } }),
    enabled: open,
  });

  const rows = (q.data ?? []) as Row[];
  const active = useMemo(() => rows.filter((r) => r.active), [rows]);

  const { cheapestId, fastestId, bestValueId } = useMemo(() => {
    if (active.length === 0) return { cheapestId: null, fastestId: null, bestValueId: null };
    const withTtc = active.map((r) => ({
      r,
      ttc: r.purchase_price_cents * (1 + r.tax_rate / 100) + r.shipping_cost_cents,
      lead: r.estimated_delivery_days ?? r.supplier?.default_lead_days ?? 99,
    }));
    const cheap = withTtc.reduce((a, b) => (a.ttc <= b.ttc ? a : b));
    const fast = withTtc.reduce((a, b) => (a.lead <= b.lead ? a : b));
    // best value = normalized price + lead (0..1 each)
    const maxTtc = Math.max(...withTtc.map((x) => x.ttc)) || 1;
    const maxLead = Math.max(...withTtc.map((x) => x.lead)) || 1;
    const scored = withTtc.map((x) => ({ ...x, score: (x.ttc / maxTtc) + (x.lead / maxLead) }));
    const best = scored.reduce((a, b) => (a.score <= b.score ? a : b));
    return { cheapestId: cheap.r.id, fastestId: fast.r.id, bestValueId: best.r.id };
  }, [active]);

  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Comparateur fournisseurs${itemName ? ` — ${itemName}` : ""}`}
      description="Comparez prix, délais et conditions. Le choix final vous appartient."
      size="xl"
    >
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : active.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <Info className="mx-auto mb-2 h-5 w-5" />
          Aucun fournisseur actif n'est associé à cet article.
          <br />
          Associez-en un depuis la fiche stock pour activer le comparateur.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1"><Star className="h-3 w-3" />Principal</Badge>
            <Badge variant="outline" className="gap-1"><TrendingDown className="h-3 w-3" />Moins cher</Badge>
            <Badge variant="outline" className="gap-1"><Zap className="h-3 w-3" />Plus rapide</Badge>
            <Badge variant="outline" className="gap-1"><Award className="h-3 w-3" />Meilleur compromis</Badge>
          </div>
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fournisseur</th>
                  <th className="px-3 py-2 font-medium">Réf.</th>
                  <th className="px-3 py-2 font-medium text-right">HT</th>
                  <th className="px-3 py-2 font-medium text-right">TVA</th>
                  <th className="px-3 py-2 font-medium text-right">TTC</th>
                  <th className="px-3 py-2 font-medium text-right">Délai</th>
                  <th className="px-3 py-2 font-medium text-right">Min / Cond.</th>
                  <th className="px-3 py-2 font-medium text-right">Livraison</th>
                  <th className="px-3 py-2 font-medium">M.à.j.</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {active.map((r) => {
                  const ttc = r.purchase_price_cents * (1 + r.tax_rate / 100);
                  const lead = r.estimated_delivery_days ?? r.supplier?.default_lead_days ?? null;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 font-medium">
                          {r.supplier?.name ?? "—"}
                          {r.is_primary && <Star className="h-3.5 w-3.5 text-electric" aria-label="Principal" />}
                          {r.id === cheapestId && <TrendingDown className="h-3.5 w-3.5 text-success" aria-label="Moins cher" />}
                          {r.id === fastestId && <Zap className="h-3.5 w-3.5 text-warning" aria-label="Plus rapide" />}
                          {r.id === bestValueId && <Award className="h-3.5 w-3.5 text-info" aria-label="Meilleur compromis" />}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[r.supplier?.email, r.supplier?.phone].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.supplier_product_reference ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.purchase_price_cents)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.tax_rate}%</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(Math.round(ttc))}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{lead != null ? `${lead} j` : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.min_order_qty} / {r.pack_qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {r.shipping_cost_cents > 0 ? formatMoney(r.shipping_cost_cents) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.last_price_update_at ? new Date(r.last_price_update_at).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {onSelect && (
                          <Button size="sm" variant="outline" onClick={() => { onSelect(r); onClose(); }}>
                            Choisir
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            <Info className="inline h-3 w-3 mr-1" />
            Sélection à confirmer manuellement. Aucun choix automatique n'est fait sur le seul critère de prix.
          </p>
        </div>
      )}
    </DialogShell>
  );
}