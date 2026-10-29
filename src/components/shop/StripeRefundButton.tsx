import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Undo2, Loader2 } from "lucide-react";
import { refundStripePayment } from "@/lib/stripe-checkout.functions";
import { formatMoney } from "@/lib/money";

export function StripeRefundButton({ shopId, paymentId, maxCents, currency }: {
  shopId: string; paymentId: string; maxCents: number; currency: string;
}) {
  const qc = useQueryClient();
  const refundFn = useServerFn(refundStripePayment);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>((maxCents / 100).toFixed(2));

  const mut = useMutation({
    mutationFn: async () => {
      const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      if (!cents || cents <= 0 || cents > maxCents) throw new Error("Montant invalide");
      return refundFn({ data: { shopId, paymentId, amountCents: cents } });
    },
    onSuccess: (res) => {
      toast.success(`Remboursement lancé (${formatMoney(res.amount, currency)}). La mise à jour arrive via webhook.`);
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Impossible de rembourser"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rembourser le paiement</DialogTitle>
          <DialogDescription>
            Montant maximum remboursable : <strong>{formatMoney(maxCents, currency)}</strong>.
            Le remboursement est envoyé à Stripe puis rapproché automatiquement.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="refund-amount">Montant ({currency})</Label>
          <Input
            id="refund-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Rembourser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}