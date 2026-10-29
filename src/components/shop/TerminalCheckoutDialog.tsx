import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CreditCard, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { listTerminalReaders } from "@/lib/terminal/readers.functions";
import { getTerminalPaymentState, cancelTerminalPayment } from "@/lib/terminal/checkout.functions";
import { startInvoiceTerminalPayment } from "@/lib/terminal/invoice-checkout.functions";
import { formatMoney } from "@/lib/money";
import { Link } from "@tanstack/react-router";

/**
 * Reusable TPE checkout dialog for an EXISTING invoice.
 * Steps: réader selection → récap → envoi → attente → succès/échec.
 */
export function TerminalCheckoutDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shopId: string;
  invoiceId: string;
  invoiceNumber?: string | null;
  amountDueCents: number;
  currency?: string;
  customerLabel?: string | null;
}) {
  const { open, onOpenChange, shopId, invoiceId, invoiceNumber, amountDueCents, currency = "EUR", customerLabel } = props;
  const readerFn = useServerFn(listTerminalReaders);
  const startFn = useServerFn(startInvoiceTerminalPayment);
  const stateFn = useServerFn(getTerminalPaymentState);
  const cancelFn = useServerFn(cancelTerminalPayment);

  const readers = useQuery({
    queryKey: ["terminal-readers", shopId],
    queryFn: () => readerFn({ data: { shopId } }),
    enabled: open,
  });
  const [readerId, setReaderId] = useState<string>("");
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (open && !readerId && readers.data?.length) {
      const def = readers.data.find((r: any) => r.is_default && r.active) ?? readers.data.find((r: any) => r.active) ?? readers.data[0];
      if (def) setReaderId(def.id);
    }
  }, [open, readers.data, readerId]);

  const startM = useMutation({
    mutationFn: () => startFn({ data: { shopId, invoiceId, readerId } }),
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
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const status = (state.data as any)?.status;
  const localState = (state.data as any)?.local_state;
  const inProgress = !!activePaymentId && status !== "confirmed" && status !== "failed" && status !== "cancelled";
  const activeReaders = (readers.data ?? []).filter((r: any) => r.active);

  const closeSafely = (v: boolean) => {
    if (!v && inProgress) {
      const ok = window.confirm(
        "Un paiement est en cours au TPE. Fermer la fenêtre ne l'annulera pas. Poursuivre ?",
      );
      if (!ok) return;
    }
    onOpenChange(v);
    if (!v) {
      // reset for next opening
      setActivePaymentId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={closeSafely}>
      <DialogContent className="max-w-lg" onEscapeKeyDown={(e) => { if (inProgress) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Encaisser au TPE
          </DialogTitle>
          <DialogDescription>
            Facture {invoiceNumber ?? invoiceId.slice(0, 8)}
            {customerLabel ? ` · ${customerLabel}` : ""}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTitle className="flex items-center gap-2">
            <Badge variant="outline">MODE TEST STRIPE</Badge>
          </AlertTitle>
          <AlertDescription className="text-xs">Aucun paiement réel n'est traité. Utilisez un lecteur simulé Stripe.</AlertDescription>
        </Alert>

        {!activePaymentId ? (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Solde à encaisser</span><span className="font-semibold tabular-nums">{formatMoney(amountDueCents, currency)}</span></div>
            </div>

            <div className="space-y-2">
              <Label>Lecteur</Label>
              {readers.isLoading ? (
                <div className="text-sm text-muted-foreground">Chargement…</div>
              ) : activeReaders.length === 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Aucun lecteur actif</AlertTitle>
                  <AlertDescription>
                    Configurez un lecteur dans <Link to="/app/shop/$shopId/settings/terminals" params={{ shopId }} className="underline">Réglages → Lecteurs TPE</Link>.
                  </AlertDescription>
                </Alert>
              ) : (
                <Select value={readerId} onValueChange={setReaderId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un lecteur" /></SelectTrigger>
                  <SelectContent>
                    {activeReaders.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                        {r.is_default ? " ★" : ""}
                        {r.is_simulated ? " (simulé)" : ""}
                        {r.status && r.status !== "online" ? ` — ${r.status}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">État : {labelForState(localState, status)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {status === "confirmed" ? "Paiement confirmé." :
                 status === "failed" ? ((state.data as any)?.terminal_last_error ?? "Paiement refusé.") :
                 status === "cancelled" ? "Paiement annulé." :
                 "Présentez, insérez ou approchez la carte du terminal."}
              </div>
            </div>

            {status === "confirmed" && (
              <div className="rounded-md border border-green-500 p-3 text-sm bg-green-50 dark:bg-green-950">
                <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4" />Paiement accepté
                </div>
                <div className="text-xs mt-1">
                  Montant : {formatMoney((state.data as any)?.amount_cents ?? 0)} ·
                  Carte : {(state.data as any)?.card_brand ?? "—"}
                  {(state.data as any)?.card_last4 ? ` •••• ${(state.data as any).card_last4}` : ""}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!activePaymentId ? (
            <>
              <Button variant="outline" onClick={() => closeSafely(false)}>Fermer</Button>
              <Button
                onClick={() => startM.mutate()}
                disabled={!readerId || startM.isPending || activeReaders.length === 0}
              >
                {startM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Envoyer {formatMoney(amountDueCents, currency)} au TPE
              </Button>
            </>
          ) : status === "confirmed" ? (
            <Button onClick={() => closeSafely(false)}>Terminer</Button>
          ) : status === "failed" || status === "cancelled" ? (
            <>
              <Button variant="outline" onClick={() => setActivePaymentId(null)}>Nouvel essai</Button>
              <Button onClick={() => closeSafely(false)}>Fermer</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => cancelM.mutate()} disabled={cancelM.isPending}>
              <X className="mr-1 h-4 w-4" />Annuler la demande
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function labelForState(local: string | undefined, status: string | undefined): string {
  if (status === "confirmed") return "Accepté";
  if (status === "failed") return "Refusé";
  if (status === "cancelled") return "Annulé";
  switch (local) {
    case "creating_payment": return "Préparation…";
    case "waiting_for_reader": return "Envoyé au terminal";
    case "presenting_card": return "Carte attendue";
    case "processing": return "Traitement…";
    case "refund_pending": return "Remboursement en cours";
    case "refunded": return "Remboursé";
    default: return local ?? status ?? "…";
  }
}