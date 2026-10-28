import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DialogShell, FormActions } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { closePurchaseOrderVariance } from "@/lib/purchasing.functions";

const REASONS = [
  { v: "supplier_shortage", label: "Rupture fournisseur" },
  { v: "damaged_delivery", label: "Marchandise endommagée" },
  { v: "wrong_items", label: "Articles incorrects livrés" },
  { v: "supplier_cancel", label: "Reliquat annulé par fournisseur" },
  { v: "customer_cancel", label: "Besoin annulé côté atelier" },
  { v: "other", label: "Autre" },
];

export function VarianceCloseDialog({
  open, onClose, shopId, poId, poRef, onDone,
}: {
  open: boolean; onClose: () => void;
  shopId: string; poId: string; poRef: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const fn = useServerFn(closePurchaseOrderVariance);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: () => fn({ data: { shopId, id: poId, reason, note: note || null } }),
    onSuccess: () => {
      toast.success("Bon clôturé avec écart");
      qc.invalidateQueries({ queryKey: ["po", shopId] });
      qc.invalidateQueries({ queryKey: ["po", shopId, poId] });
      qc.invalidateQueries({ queryKey: ["po-stats", shopId] });
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) { toast.error("Choisissez un motif"); return; }
    mut.mutate();
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(o) => !o && !mut.isPending && onClose()}
      title={`Clôturer ${poRef} avec écart`}
      description="Utilisez cette action quand le reliquat ne sera jamais livré (fournisseur, annulation, dégât). Le bon est figé et n'accepte plus de réception."
      size="md"
      footer={
        <FormActions>
          <Button type="button" variant="ghost" onClick={onClose} disabled={mut.isPending}>Annuler</Button>
          <Button type="submit" form="variance-form" disabled={mut.isPending || !reason} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {mut.isPending ? "Clôture…" : "Clôturer avec écart"}
          </Button>
        </FormActions>
      }
    >
      <form id="variance-form" onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="var-reason">Motif *</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="var-reason"><SelectValue placeholder="Choisir un motif…" /></SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => <SelectItem key={r.v} value={r.v}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="var-note">Commentaire</Label>
          <Textarea id="var-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Précisions internes (traçabilité)…" />
        </div>
        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
          Le stock déjà réceptionné reste acquis. Aucun mouvement de stock supplémentaire n'est effectué par cette action.
        </div>
      </form>
    </DialogShell>
  );
}