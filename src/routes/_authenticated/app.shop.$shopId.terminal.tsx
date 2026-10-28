import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { PageContainer, PageHeader } from "@/components/ui-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Loader2, CreditCard, CheckCircle2, X } from "lucide-react";
import { listTerminalReaders } from "@/lib/terminal/readers.functions";
import { startTerminalPayment, getTerminalPaymentState, cancelTerminalPayment } from "@/lib/terminal/checkout.functions";
import { formatMoney } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/terminal")({
  head: () => ({ meta: [{ title: "Encaisser au TPE — BPEI" }] }),
  component: TerminalCheckoutPage,
});

type Line = {
  line_type: "product" | "service" | "custom";
  name: string;
  description?: string;
  quantity: number;
  unit_price_cents: number;
  discount_percent: number;
  tax_rate: number;
};

function TerminalCheckoutPage() {
  const ctx = useShop();
  const shopId = ctx.shopId;
  const qc = useQueryClient();
  const readerFn = useServerFn(listTerminalReaders);
  const readers = useQuery({ queryKey: ["terminal-readers", shopId], queryFn: () => readerFn({ data: { shopId } }) });

  const [lines, setLines] = useState<Line[]>([
    { line_type: "service", name: "", quantity: 1, unit_price_cents: 0, discount_percent: 0, tax_rate: 20 },
  ]);
  const [readerId, setReaderId] = useState<string>("");
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (!readerId && readers.data?.length) {
      const def = readers.data.find((r: any) => r.is_default) ?? readers.data[0];
      setReaderId(def.id);
    }
  }, [readers.data, readerId]);

  const totals = useMemo(() => {
    let sub = 0, tax = 0, disc = 0;
    for (const l of lines) {
      const gross = Math.round((l.quantity || 0) * (l.unit_price_cents || 0));
      const d = Math.round(gross * ((l.discount_percent || 0) / 100));
      const net = gross - d;
      const t = Math.round(net * ((l.tax_rate || 0) / 100));
      sub += net; tax += t; disc += d;
    }
    return { sub, tax, disc, total: sub + tax };
  }, [lines]);

  const startFn = useServerFn(startTerminalPayment);
  const cancelFn = useServerFn(cancelTerminalPayment);
  const stateFn = useServerFn(getTerminalPaymentState);

  const startM = useMutation({
    mutationFn: () => startFn({ data: {
      shopId, readerId, source: "free",
      lines: lines.filter((l) => l.name && l.unit_price_cents > 0),
    } }),
    onSuccess: (res) => setActivePaymentId(res.paymentId),
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const state = useQuery({
    queryKey: ["terminal-payment-state", activePaymentId],
    queryFn: () => stateFn({ data: { paymentId: activePaymentId! } }),
    enabled: !!activePaymentId,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.status;
      return s === "confirmed" || s === "failed" || s === "cancelled" ? false : 2000;
    },
  });

  const cancelM = useMutation({
    mutationFn: () => cancelFn({ data: { paymentId: activePaymentId! } }),
    onSuccess: () => { toast("Demande annulée"); qc.invalidateQueries({ queryKey: ["terminal-payment-state", activePaymentId] }); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const status = (state.data as any)?.status;
  const localState = (state.data as any)?.local_state;
  const canStart = readerId && totals.total > 0 && lines.some((l) => l.name && l.unit_price_cents > 0);

  return (
    <PageContainer>
      <PageHeader title="Encaisser au TPE" description="Envoi direct au terminal Stripe de la boutique." />
      <Alert className="mb-4">
        <AlertTitle>MODE TEST STRIPE</AlertTitle>
        <AlertDescription>Aucun paiement réel. Utilisez un lecteur simulé ou un lecteur physique en mode test.</AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Lignes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end border-b pb-2">
                <div className="col-span-5">
                  <Label className="text-xs">Désignation</Label>
                  <Input value={l.name} onChange={(e) => setLines(lines.map((x, j) => i===j ? {...x, name: e.target.value} : x))}
                    placeholder="Ex : Installation Windows" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Qté</Label>
                  <Input type="number" min={0.001} step="0.01" value={l.quantity}
                    onChange={(e) => setLines(lines.map((x, j) => i===j ? {...x, quantity: Number(e.target.value)} : x))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">PU HT (€)</Label>
                  <Input type="number" min={0} step="0.01" value={l.unit_price_cents / 100}
                    onChange={(e) => setLines(lines.map((x, j) => i===j ? {...x, unit_price_cents: Math.round(Number(e.target.value) * 100)} : x))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">TVA %</Label>
                  <Input type="number" min={0} step="0.5" value={l.tax_rate}
                    onChange={(e) => setLines(lines.map((x, j) => i===j ? {...x, tax_rate: Number(e.target.value)} : x))} />
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="sm" onClick={() => setLines(lines.filter((_, j) => j!==i))} aria-label="Supprimer ligne">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines([...lines, { line_type: "service", name: "", quantity: 1, unit_price_cents: 0, discount_percent: 0, tax_rate: 20 }])}>
              <Plus className="h-4 w-4 mr-1" />Ajouter une ligne
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Sous-total HT</span><span>{formatMoney(totals.sub)}</span></div>
            <div className="flex justify-between"><span>Remises</span><span>−{formatMoney(totals.disc)}</span></div>
            <div className="flex justify-between"><span>TVA</span><span>{formatMoney(totals.tax)}</span></div>
            <div className="flex justify-between font-semibold text-base border-t pt-2"><span>Total TTC</span><span>{formatMoney(totals.total)}</span></div>

            <div className="pt-3">
              <Label>Lecteur</Label>
              <Select value={readerId} onValueChange={setReaderId}>
                <SelectTrigger><SelectValue placeholder="Choisir un lecteur" /></SelectTrigger>
                <SelectContent>
                  {(readers.data ?? []).map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label} {r.is_default ? "★" : ""} {r.is_simulated ? "(simulé)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!readers.isLoading && (readers.data ?? []).length === 0) && (
                <p className="text-xs text-destructive mt-1">Aucun lecteur. Configurez-en un dans Réglages → Lecteurs TPE.</p>
              )}
            </div>

            {!activePaymentId ? (
              <Button className="w-full mt-3" size="lg" disabled={!canStart || startM.isPending}
                onClick={() => startM.mutate()}>
                {startM.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                Envoyer {formatMoney(totals.total)} au TPE
              </Button>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="rounded-md border p-3 text-sm">
                  <div className="font-medium">État : {localState ?? status ?? "…"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {status === "confirmed" ? "Paiement confirmé." :
                     status === "failed" ? ((state.data as any)?.terminal_last_error ?? "Échec") :
                     status === "cancelled" ? "Annulé." :
                     "Présentez, insérez ou approchez la carte du terminal."}
                  </div>
                </div>
                {status === "confirmed" ? (
                  <div className="rounded-md border border-green-500 p-3 text-sm bg-green-50 dark:bg-green-950">
                    <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-300">
                      <CheckCircle2 className="h-4 w-4" />Paiement accepté
                    </div>
                    <div className="text-xs mt-1">
                      Montant : {formatMoney((state.data as any)?.amount_cents ?? 0)} ·
                      Carte : {(state.data as any)?.card_brand ?? "—"} {(state.data as any)?.card_last4 ? `•••• ${(state.data as any).card_last4}` : ""}
                    </div>
                    <Button className="mt-2" size="sm" variant="outline" onClick={() => {
                      setActivePaymentId(null);
                      setLines([{ line_type: "service", name: "", quantity: 1, unit_price_cents: 0, discount_percent: 0, tax_rate: 20 }]);
                    }}>Nouvelle vente</Button>
                  </div>
                ) : (status !== "failed" && status !== "cancelled") ? (
                  <Button variant="outline" size="sm" onClick={() => cancelM.mutate()} disabled={cancelM.isPending}>
                    <X className="h-4 w-4 mr-1" />Annuler la demande
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setActivePaymentId(null)}>Nouvel essai</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}