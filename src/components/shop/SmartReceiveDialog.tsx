import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DialogShell, FormActions } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, toCents } from "@/lib/money";
import { receiveLineWithVariance } from "@/lib/purchasing.functions";
import { getBillingSettings } from "@/lib/billing-settings.functions";
import { listStockItems } from "@/lib/stock.functions";
import { AlertTriangle, CheckCircle2, PackageCheck } from "lucide-react";

type Line = {
  id: string;
  item_id: string | null;
  name: string;
  sku: string | null;
  quantity: number | string;
  received_quantity: number | string;
  unit_price_cents: number;
  tax_rate: number;
};

type Decision = "none" | "accept_and_update" | "accept_this_only" | "refuse";

type LineDraft = {
  receiveQty: string;
  damagedQty: string;
  unitPrice: string;
  status: "conforme" | "manquant" | "endommage" | "incorrect" | "prix_different" | "reliquat_annule";
  decision: Decision;
  reason: string;
  note: string;
};

const STATUS_LABEL: Record<LineDraft["status"], string> = {
  conforme: "Conforme",
  manquant: "Quantité manquante",
  endommage: "Marchandise endommagée",
  incorrect: "Article incorrect",
  prix_different: "Prix différent",
  reliquat_annule: "Reliquat annulé",
};

const DECISION_LABEL: Record<Exclude<Decision, "none">, string> = {
  accept_and_update: "Mettre à jour le prix fournisseur",
  accept_this_only: "Accepter pour cette commande uniquement",
  refuse: "Refuser l'écart (garder prix commandé)",
};

export function SmartReceiveDialog({
  open, onClose, shopId, poId, lines, onDone,
}: {
  open: boolean;
  onClose: () => void;
  shopId: string;
  poId: string;
  lines: Line[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const recvFn = useServerFn(receiveLineWithVariance);
  const itemsFn = useServerFn(listStockItems);
  const settingsFn = useServerFn(getBillingSettings);

  const itemsQ = useQuery({
    queryKey: ["stock-items-recv", shopId],
    queryFn: () => itemsFn({ data: { shopId } }),
    enabled: open,
  });
  const settingsQ = useQuery({
    queryKey: ["billing-settings", shopId],
    queryFn: () => settingsFn({ data: { shopId } }),
    enabled: open,
  });
  const pctThresh = Number((settingsQ.data as any)?.purchase_price_variance_warning_pct ?? 5);
  const centsThresh = Number((settingsQ.data as any)?.purchase_price_variance_warning_cents ?? 500);

  const itemsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const it of (itemsQ.data ?? []) as any[]) m.set(it.id, it);
    return m;
  }, [itemsQ.data]);

  const [deliveryNote, setDeliveryNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>(() => {
    const d: Record<string, LineDraft> = {};
    for (const l of lines) {
      const remain = Number(l.quantity) - Number(l.received_quantity);
      d[l.id] = {
        receiveQty: remain > 0 ? String(remain) : "0",
        damagedQty: "0",
        unitPrice: (l.unit_price_cents / 100).toString(),
        status: "conforme",
        decision: "none",
        reason: "",
        note: "",
      };
    }
    return d;
  });

  const update = (id: string, patch: Partial<LineDraft>) =>
    setDrafts((m) => ({ ...m, [id]: { ...m[id], ...patch } }));

  const submit = async () => {
    const toProcess: { line: Line; draft: LineDraft; qty: number; damaged: number; actualCents: number }[] = [];
    for (const l of lines) {
      const d = drafts[l.id];
      if (!d) continue;
      const remain = Number(l.quantity) - Number(l.received_quantity);
      if (d.status === "reliquat_annule") continue;
      const q = parseFloat(d.receiveQty) || 0;
      const dam = parseFloat(d.damagedQty) || 0;
      if (q <= 0) continue;
      if (q > remain) { toast.error(`${l.name} : réception (${q}) > reste (${remain})`); return; }
      if (dam < 0 || dam > q) { toast.error(`${l.name} : endommagé doit être entre 0 et ${q}`); return; }
      const actualCents = toCents(d.unitPrice);
      const diffCents = actualCents - l.unit_price_cents;
      const diffPct = l.unit_price_cents > 0 ? Math.abs(diffCents) / l.unit_price_cents * 100 : 0;
      const over = l.unit_price_cents > 0 && (Math.abs(diffCents) >= centsThresh || diffPct >= pctThresh);
      if (actualCents !== l.unit_price_cents && d.decision === "none") {
        toast.error(`${l.name} : écart de prix — choisissez une décision`);
        return;
      }
      if (over && d.decision !== "refuse" && !d.reason.trim()) {
        toast.error(`${l.name} : motif requis (écart supérieur au seuil)`);
        return;
      }
      if (d.decision === "refuse" && !d.reason.trim()) {
        toast.error(`${l.name} : motif requis pour refuser l'écart`);
        return;
      }
      toProcess.push({ line: l, draft: d, qty: q, damaged: dam, actualCents });
    }
    if (toProcess.length === 0) { toast.error("Aucune ligne à réceptionner"); return; }
    setBusy(true);
    let ok = 0;
    try {
      for (const p of toProcess) {
        const parts: string[] = [`[${STATUS_LABEL[p.draft.status]}]`];
        if (p.damaged > 0) parts.push(`endommagé: ${p.damaged}`);
        if (p.actualCents !== p.line.unit_price_cents) {
          parts.push(`prix reçu: ${formatMoney(p.actualCents)} (bon: ${formatMoney(p.line.unit_price_cents)})`);
        }
        if (p.draft.note.trim()) parts.push(p.draft.note.trim());
        await recvFn({ data: {
          shopId, lineId: p.line.id,
          quantity: p.qty,
          damaged: p.damaged,
          note: parts.join(" · "),
          deliveryNote: deliveryNote.trim() || null,
          actualUnitPriceCents: p.actualCents,
          decision: p.draft.decision,
          reason: p.draft.reason.trim() || null,
        } });
        ok++;
      }
      toast.success(`${ok} ligne${ok > 1 ? "s" : ""} réceptionnée${ok > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["po", shopId, poId] });
      qc.invalidateQueries({ queryKey: ["po", shopId] });
      qc.invalidateQueries({ queryKey: ["po-stats", shopId] });
      qc.invalidateQueries({ queryKey: ["stock-items", shopId] });
      qc.invalidateQueries({ queryKey: ["stock-movements", shopId] });
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur de réception");
    } finally { setBusy(false); }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      title="Réception intelligente"
      description={`Seuil d'écart configuré : ${pctThresh}% ou ${(centsThresh / 100).toFixed(2)} €. Au-delà, un motif est requis.`}
      size="xl"
      footer={
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 flex items-center gap-2">
            <Label htmlFor="bl-ref" className="text-xs whitespace-nowrap">N° BL</Label>
            <Input id="bl-ref" placeholder="Réf. bon de livraison"
              value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)}
              className="h-8 max-w-xs" />
          </div>
          <FormActions>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
            <Button type="button" onClick={submit} disabled={busy} className="bg-electric text-electric-foreground hover:bg-electric/90">
              <PackageCheck className="mr-1 h-4 w-4" />
              {busy ? "Réception…" : "Valider la réception"}
            </Button>
          </FormActions>
        </div>
      }
    >
      <div className="overflow-auto -mx-6 px-6">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 font-medium">Article</th>
              <th className="px-2 py-2 font-medium text-right">Cmdé</th>
              <th className="px-2 py-2 font-medium text-right">Reste</th>
              <th className="px-2 py-2 font-medium text-right">Stock</th>
              <th className="px-2 py-2 font-medium text-right w-20">Reçu</th>
              <th className="px-2 py-2 font-medium text-right w-20">End.</th>
              <th className="px-2 py-2 font-medium text-right w-28">PU HT reçu</th>
              <th className="px-2 py-2 font-medium w-36">Statut</th>
              <th className="px-2 py-2 font-medium">Écart / Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top">
            {lines.map((l) => {
              const remain = Number(l.quantity) - Number(l.received_quantity);
              const d = drafts[l.id];
              if (!d) return null;
              const stock = l.item_id ? itemsById.get(l.item_id) : null;
              const currentPriceCents = toCents(d.unitPrice);
              const diffCents = currentPriceCents - l.unit_price_cents;
              const diffPct = l.unit_price_cents > 0 ? Math.abs(diffCents) / l.unit_price_cents * 100 : 0;
              const priceVariance = diffCents !== 0;
              const over = l.unit_price_cents > 0 && (Math.abs(diffCents) >= centsThresh || diffPct >= pctThresh);
              const qty = parseFloat(d.receiveQty) || 0;
              const totalImpact = diffCents * qty;
              const disabled = remain <= 0 || d.status === "reliquat_annule";
              return (
                <tr key={l.id}>
                  <td className="px-2 py-2">
                    <div className="font-medium leading-tight">{l.name}</div>
                    {l.sku && <div className="text-xs text-muted-foreground">{l.sku}</div>}
                    {!l.item_id && <div className="text-xs text-warning">Non lié au stock</div>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{Number(l.quantity)}</td>
                  <td className={`px-2 py-2 text-right tabular-nums font-medium ${remain > 0 ? "text-warning" : "text-success"}`}>{remain}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    {stock ? Number(stock.quantity) : "—"}
                  </td>
                  <td className="px-2 py-2">
                    <Input inputMode="decimal" value={d.receiveQty}
                      onChange={(e) => update(l.id, { receiveQty: e.target.value })}
                      disabled={disabled}
                      className="h-8 text-right tabular-nums" />
                  </td>
                  <td className="px-2 py-2">
                    <Input inputMode="decimal" value={d.damagedQty}
                      onChange={(e) => update(l.id, { damagedQty: e.target.value })}
                      disabled={disabled}
                      className="h-8 text-right tabular-nums" />
                  </td>
                  <td className="px-2 py-2">
                    <Input inputMode="decimal" value={d.unitPrice}
                      onChange={(e) => {
                        const nv = e.target.value;
                        const nc = toCents(nv);
                        update(l.id, {
                          unitPrice: nv,
                          status: nc !== l.unit_price_cents ? "prix_different" : (d.status === "prix_different" ? "conforme" : d.status),
                          decision: nc === l.unit_price_cents ? "none" : d.decision,
                        });
                      }}
                      disabled={disabled}
                      className={`h-8 text-right tabular-nums ${over ? "border-destructive" : priceVariance ? "border-warning" : ""}`} />
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      cmdé: {formatMoney(l.unit_price_cents)}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Select value={d.status} onValueChange={(v) => update(l.id, { status: v as LineDraft["status"] })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {d.status === "conforme" && !priceVariance && remain > 0 && (
                      <div className="text-[10px] text-success inline-flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" />OK
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 space-y-1">
                    {priceVariance && (
                      <div className={`text-[11px] ${over ? "text-destructive font-semibold" : "text-warning"} inline-flex items-center gap-1`}>
                        <AlertTriangle className="h-3 w-3" />
                        {diffCents > 0 ? "+" : ""}{formatMoney(diffCents)} ({diffPct.toFixed(1)}%)
                        {qty > 0 && <span className="ml-1">· impact {diffCents > 0 ? "+" : ""}{formatMoney(totalImpact)}</span>}
                      </div>
                    )}
                    {priceVariance && (
                      <Select value={d.decision} onValueChange={(v) => update(l.id, { decision: v as Decision })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Décision requise…" /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(DECISION_LABEL).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {priceVariance && (over || d.decision === "refuse") && (
                      <Input
                        value={d.reason}
                        onChange={(e) => update(l.id, { reason: e.target.value })}
                        placeholder="Motif obligatoire…"
                        className="h-7 text-xs"
                      />
                    )}
                    <Textarea rows={1} value={d.note}
                      onChange={(e) => update(l.id, { note: e.target.value })}
                      disabled={d.status === "reliquat_annule" && remain <= 0}
                      placeholder={d.status === "endommage" || d.status === "incorrect" ? "Décrire…" : "Note libre"}
                      className="min-h-[28px] text-xs" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Les unités endommagées sont placées en <b>quarantaine</b> (hors stock disponible). Les lignes en <b>Reliquat annulé</b> ne sont pas mouvementées ici.
      </p>
    </DialogShell>
  );
}