import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { refundTerminalPayment } from "@/lib/terminal/refunds.functions";
import { getShopStripeStatus } from "@/lib/stripe-connect.functions";
import { formatMoney } from "@/lib/money";

/**
 * TPE refund button — TOTAL only for the first version.
 * Renders nothing if the payment is not a Terminal Stripe payment, or if it
 * has already been refunded, or the caller has no manager rights (server enforces too).
 */
export function TerminalRefundButton(props: {
  shopId: string;
  payment: {
    id: string;
    amount_cents: number;
    currency?: string;
    provider?: string | null;
    connector_type?: string | null;
    status?: string;
    refunded_amount_cents?: number | null;
    stripe_payment_intent_id?: string | null;
    stripe_refund_id?: string | null;
  };
  onRefunded?: () => void;
}) {
  const { shopId, payment, onRefunded } = props;
  const statusFn = useServerFn(getShopStripeStatus);
  const stripeStatus = useQuery({ queryKey: ["shop-stripe-status", shopId], queryFn: () => statusFn({ data: { shopId } }), staleTime: 60_000 });
  const refundFn = useServerFn(refundTerminalPayment);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const m = useMutation({
    mutationFn: () => refundFn({ data: { paymentId: payment.id, reason: reason.trim(), restockConfirmed: restock } }),
    onSuccess: (res) => {
      toast.success(`Remboursement effectué (avoir ${res.creditNote?.credit_note_number ?? res.creditNote?.credit_note_id?.slice(0, 8) ?? ""}).`);
      setOpen(false);
      onRefunded?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Impossible de rembourser"),
  });

  if (payment.provider !== "stripe" || payment.connector_type !== "stripe_terminal") return null;
  if (payment.status !== "confirmed") return null;
  const alreadyRefunded = (payment.refunded_amount_cents ?? 0) >= payment.amount_cents;
  if (alreadyRefunded) return null;
  if (!stripeStatus.data?.stripe_charges_enabled) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw className="mr-2 h-4 w-4" />Rembourser {formatMoney(payment.amount_cents, payment.currency ?? "EUR")}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (!m.isPending) setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rembourser au TPE</DialogTitle>
            <DialogDescription>
              Remboursement TOTAL uniquement. Un avoir numéroté sera créé et rattaché à la facture. Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <div className="flex justify-between"><span>Montant remboursé</span><span className="font-semibold tabular-nums">{formatMoney(payment.amount_cents, payment.currency ?? "EUR")}</span></div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="refund-reason">Motif (obligatoire)</Label>
              <Textarea id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Ex : Client insatisfait, produit défectueux…" />
            </div>

            <div className="space-y-2 rounded-md border bg-muted/40 p-3">
              <div className="text-sm font-medium">Les produits ont-ils été retournés ?</div>
              <div className="flex items-start gap-2">
                <Checkbox id="restock" checked={restock} onCheckedChange={(v) => setRestock(!!v)} />
                <label htmlFor="restock" className="text-sm text-muted-foreground leading-tight">
                  Oui, remettre les produits en stock. (Les services ne sont jamais réintégrés.)
                </label>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox id="confirm-total" checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} />
              <label htmlFor="confirm-total" className="text-sm">
                Je confirme le remboursement total de {formatMoney(payment.amount_cents, payment.currency ?? "EUR")}.
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={m.isPending}>Annuler</Button>
            <Button
              onClick={() => m.mutate()}
              disabled={m.isPending || reason.trim().length < 3 || !confirmed}
              variant="destructive"
            >
              {m.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              Rembourser {formatMoney(payment.amount_cents, payment.currency ?? "EUR")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}