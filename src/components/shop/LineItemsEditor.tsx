import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { formatMoney, computeLine, toCents } from "@/lib/money";

export interface EditableLine {
  id?: string;
  line_type: "service" | "product" | "labour" | "discount" | "other";
  catalog_item_id?: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  discount_percent: number;
  tax_rate: number;
  display_order: number;
}

export function emptyLine(order = 0): EditableLine {
  return {
    line_type: "service",
    description: "",
    quantity: 1,
    unit: "unité",
    unit_price_cents: 0,
    discount_percent: 0,
    tax_rate: 20,
    display_order: order,
  };
}

export function LineItemsEditor({
  value, onChange, catalog, disabled,
}: {
  value: EditableLine[];
  onChange: (lines: EditableLine[]) => void;
  catalog?: Array<{ id: string; name: string; unit_price_cents: number; tax_rate: number; unit: string; line_type: string; description: string | null }>;
  disabled?: boolean;
}) {
  const totals = value.reduce(
    (acc, l) => {
      const c = computeLine(l);
      acc.sub += c.subtotal; acc.tax += c.tax; acc.tot += c.total;
      return acc;
    },
    { sub: 0, tax: 0, tot: 0 },
  );

  function update(idx: number, patch: Partial<EditableLine>) {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([...value, emptyLine(value.length)]);
  }
  function addFromCatalog(itemId: string) {
    const it = catalog?.find((c) => c.id === itemId);
    if (!it) return;
    onChange([...value, {
      line_type: it.line_type as any,
      catalog_item_id: it.id,
      description: it.description ? `${it.name} — ${it.description}` : it.name,
      quantity: 1,
      unit: it.unit,
      unit_price_cents: it.unit_price_cents,
      discount_percent: 0,
      tax_rate: it.tax_rate,
      display_order: value.length,
    }]);
  }

  return (
    <div className="space-y-3">
      {catalog && catalog.length > 0 && !disabled && (
        <div className="flex items-center gap-2">
          <Select onValueChange={addFromCatalog}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Ajouter depuis le catalogue…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {catalog.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — {formatMoney(c.unit_price_cents)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus className="mr-2 h-4 w-4" />Ligne libre
          </Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2 min-w-[220px]">Description</th>
              <th className="p-2 w-20">Qté</th>
              <th className="p-2 w-24">Unité</th>
              <th className="p-2 w-32">PU HT</th>
              <th className="p-2 w-20">Remise %</th>
              <th className="p-2 w-20">TVA %</th>
              <th className="p-2 w-28 text-right">Total TTC</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {value.length === 0 && (
              <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Aucune ligne.</td></tr>
            )}
            {value.map((l, idx) => {
              const c = computeLine(l);
              return (
                <tr key={idx} className="border-t">
                  <td className="p-1">
                    <Textarea rows={1} disabled={disabled} value={l.description}
                      onChange={(e) => update(idx, { description: e.target.value })} className="min-h-9" />
                  </td>
                  <td className="p-1">
                    <Input type="number" step="0.01" disabled={disabled} value={l.quantity}
                      onChange={(e) => update(idx, { quantity: Number(e.target.value) || 0 })} />
                  </td>
                  <td className="p-1">
                    <Input disabled={disabled} value={l.unit}
                      onChange={(e) => update(idx, { unit: e.target.value })} />
                  </td>
                  <td className="p-1">
                    <Input type="number" step="0.01" disabled={disabled}
                      value={(l.unit_price_cents / 100).toString()}
                      onChange={(e) => update(idx, { unit_price_cents: toCents(e.target.value) })} />
                  </td>
                  <td className="p-1">
                    <Input type="number" step="0.01" disabled={disabled} value={l.discount_percent}
                      onChange={(e) => update(idx, { discount_percent: Number(e.target.value) || 0 })} />
                  </td>
                  <td className="p-1">
                    <Input type="number" step="0.01" disabled={disabled} value={l.tax_rate}
                      onChange={(e) => update(idx, { tax_rate: Number(e.target.value) || 0 })} />
                  </td>
                  <td className="p-1 text-right font-medium">{formatMoney(c.total)}</td>
                  <td className="p-1">
                    {!disabled && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap justify-end gap-6 text-sm">
        <div>Sous-total HT : <strong>{formatMoney(totals.sub)}</strong></div>
        <div>TVA : <strong>{formatMoney(totals.tax)}</strong></div>
        <div className="text-lg">Total TTC : <strong>{formatMoney(totals.tot)}</strong></div>
      </div>
    </div>
  );
}