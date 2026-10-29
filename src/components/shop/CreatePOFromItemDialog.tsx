import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  createPOFromItem, listSupplierDraftPOs, itemConsumption, itemOnOrder,
} from "@/lib/purchasing.functions";
import { DialogShell, FormActions } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatMoney } from "@/lib/money";
import { Package, Truck } from "lucide-react";

interface Props {
  shopId: string;
  itemId: string;
  itemName: string;
  currentQty?: number;
  minThreshold?: number;
  offer: {
    id: string;
    supplier_id: string;
    supplier?: { name?: string | null } | null;
    supplier_product_reference?: string | null;
    purchase_price_cents: number;
    tax_rate: number;
    min_order_qty: number | string;
    pack_qty: number | string;
    estimated_delivery_days?: number | null;
    shipping_cost_cents?: number | null;
  };
  onClose: () => void;
}

export function CreatePOFromItemDialog({
  shopId, itemId, itemName, currentQty = 0, minThreshold = 0, offer, onClose,
}: Props) {
  const navigate = useNavigate();
  const createFn = useServerFn(createPOFromItem);
  const draftsFn = useServerFn(listSupplierDraftPOs);
  const consumptionFn = useServerFn(itemConsumption);
  const onOrderFn = useServerFn(itemOnOrder);

  const minQ = Number(offer.min_order_qty ?? 1);
  const packQ = Math.max(1, Number(offer.pack_qty ?? 1));

  const drafts = useQuery({
    queryKey: ["supplier-drafts", shopId, offer.supplier_id],
    queryFn: () => draftsFn({ data: { shopId, supplierId: offer.supplier_id } }),
  });
  const consumption = useQuery({
    queryKey: ["item-consumption", shopId, itemId],
    queryFn: () => consumptionFn({ data: { shopId, itemId, days: 30 } }),
  });
  const onOrder = useQuery({
    queryKey: ["item-on-order", shopId, itemId],
    queryFn: () => onOrderFn({ data: { shopId, itemId } }),
  });

  // Suggested quantity: max(min, threshold - available + onOrder-target)
  const available = Math.max(0, currentQty);
  const consumed30 = consumption.data?.consumed ?? 0;
  const suggested = useMemo(() => {
    const need = Math.max(minThreshold - available, Math.ceil(consumed30 / 2), minQ);
    let q = Math.max(need, minQ);
    if (packQ > 1) q = Math.ceil(q / packQ) * packQ;
    return q;
  }, [available, minThreshold, consumed30, minQ, packQ]);

  const [qtyInput, setQtyInput] = useState<string>(String(suggested));
  useEffect(() => setQtyInput(String(suggested)), [suggested]);
  const [target, setTarget] = useState<"new" | "existing">("new");
  const [existingId, setExistingId] = useState<string>("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const wantedQty = Number(qtyInput) || 0;
  const roundedQty = useMemo(() => {
    let q = Math.max(wantedQty, minQ);
    if (packQ > 1) q = Math.ceil(q / packQ) * packQ;
    return q;
  }, [wantedQty, minQ, packQ]);
  const willAdjust = roundedQty !== wantedQty;

  const priceCents = offer.purchase_price_cents;
  const lineHt = priceCents * roundedQty;
  const shipping = Number(offer.shipping_cost_cents ?? 0);

  const create = useMutation({
    mutationFn: () => createFn({
      data: {
        shopId, itemId, stockItemSupplierId: offer.id,
        quantity: roundedQty,
        target,
        existingPoId: target === "existing" ? existingId || undefined : undefined,
        idempotencyKey,
      },
    }),
    onSuccess: (r: any) => {
      toast.success(r.replayed ? "Bon déjà créé" : "Bon de commande créé");
      onClose();
      navigate({ to: "/app/shop/$shopId/purchasing", params: { shopId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const drafList = drafts.data ?? [];
  const canConfirm = roundedQty >= minQ && (target === "new" || !!existingId);

  return (
    <DialogShell
      open={true}
      onOpenChange={(v) => { if (!v) onClose(); }}
      title="Créer un bon de commande"
      description={`Article : ${itemName} — Fournisseur : ${offer.supplier?.name ?? "—"}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm md:grid-cols-4">
          <Info label="Prix HT" value={formatMoney(priceCents)} />
          <Info label="TVA" value={`${offer.tax_rate} %`} />
          <Info label="Min." value={String(minQ)} />
          <Info label="Cond." value={String(packQ)} />
          <Info label="Délai" value={offer.estimated_delivery_days != null ? `${offer.estimated_delivery_days} j` : "—"} />
          <Info label="Frais" value={formatMoney(shipping)} />
          <Info label="Réf." value={offer.supplier_product_reference || "—"} />
          <Info label="Stock actuel" value={String(currentQty)} icon={<Package className="h-3 w-3" />} />
          <Info label="Seuil alerte" value={String(minThreshold)} />
          <Info label="Déjà commandé" value={onOrder.data ? String(onOrder.data.onOrder) : "…"} icon={<Truck className="h-3 w-3" />} />
          <Info label="Conso 30j" value={consumption.data ? String(consumption.data.consumed) : "…"} />
          <Info label="Quantité suggérée" value={String(suggested)} />
        </div>

        <div className="space-y-2">
          <Label>Quantité à commander</Label>
          <Input
            type="number" inputMode="numeric" min={minQ} step={packQ}
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
          />
          {willAdjust && (
            <p className="text-xs text-warning">
              La quantité sera arrondie à <b>{roundedQty}</b> (min {minQ}, conditionnement {packQ}).
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Total ligne HT : <b className="font-mono">{formatMoney(lineHt)}</b>
            {shipping > 0 && <> + frais livraison {formatMoney(shipping)}</>}
          </p>
        </div>

        <div className="space-y-2">
          <Label>Où ajouter cette ligne ?</Label>
          <RadioGroup value={target} onValueChange={(v) => setTarget(v as any)}>
            <label className="flex items-start gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted/30">
              <RadioGroupItem value="new" id="tgt-new" className="mt-0.5" />
              <div>
                <div className="font-medium">Créer un nouveau brouillon</div>
                <div className="text-xs text-muted-foreground">Un bon distinct pour ce fournisseur.</div>
              </div>
            </label>
            {drafList.length > 0 && (
              <label className="flex items-start gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted/30">
                <RadioGroupItem value="existing" id="tgt-existing" className="mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium">Ajouter à un brouillon existant</div>
                  <select
                    className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                    value={existingId}
                    onChange={(e) => setExistingId(e.target.value)}
                    disabled={target !== "existing"}
                  >
                    <option value="">— Sélectionner —</option>
                    {drafList.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.reference} · {formatMoney(d.total_ht_cents ?? 0)}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            )}
          </RadioGroup>
        </div>

        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={!canConfirm || create.isPending}
          >
            {create.isPending ? "Création…" : (target === "existing" ? "Ajouter la ligne" : "Créer le bon")}
          </Button>
        </FormActions>
      </div>
    </DialogShell>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}