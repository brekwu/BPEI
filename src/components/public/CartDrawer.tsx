import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Minus, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { cart, useCart, cartTotals } from "@/lib/cart";
import { publicCreateOrder } from "@/lib/orders.functions";

export function CartDrawer({
  shopId, shopName, open, onOpenChange,
}: { shopId: string; shopName: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const lines = useCart(shopId);
  const totals = cartTotals(lines);
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const navigate = useNavigate();
  const createFn = useServerFn(publicCreateOrder);

  const mutation = useMutation({
    mutationFn: (payload: any) => createFn({ data: payload }),
    onSuccess: (res: any) => {
      toast.success("Commande envoyée à la boutique");
      cart.clear(shopId);
      onOpenChange(false);
      setStep("cart");
      setForm({ name: "", email: "", phone: "", notes: "" });
      navigate({ to: "/commande/$token", params: { token: res.token } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Impossible d'envoyer la commande"),
  });

  const submit = () => {
    if (!form.name.trim()) return toast.error("Votre nom est requis");
    if (!form.phone.trim()) return toast.error("Un téléphone est requis");
    if (lines.length === 0) return toast.error("Panier vide");
    mutation.mutate({
      shopId, contactName: form.name, contactEmail: form.email, contactPhone: form.phone,
      notes: form.notes, fulfillmentMode: "pickup",
      lines: lines.map((l) => ({ kind: l.kind, refId: l.refId, quantity: l.quantity })),
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Mon panier · {shopName}
          </SheetTitle>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            Votre panier est vide.
          </div>
        ) : step === "cart" ? (
          <div className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={`${l.kind}:${l.refId}`} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium leading-tight">{l.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.kind === "service" ? "Prestation" : "Produit"} · {formatMoney(l.unit_price_cents)} TTC / {l.kind === "service" ? "acte" : "unité"}
                      </div>
                    </div>
                    <button aria-label="Retirer" className="text-muted-foreground hover:text-destructive" onClick={() => cart.remove(shopId, l.kind, l.refId)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-md border">
                      <button className="px-2 py-1" onClick={() => cart.setQty(shopId, l.kind, l.refId, l.quantity - 1)}><Minus className="h-3 w-3" /></button>
                      <span className="min-w-8 text-center text-sm">{l.quantity}</span>
                      <button className="px-2 py-1" onClick={() => cart.setQty(shopId, l.kind, l.refId, l.quantity + 1)}><Plus className="h-3 w-3" /></button>
                    </div>
                    <div className="text-sm font-semibold">{formatMoney(Math.round(l.unit_price_cents * l.quantity * (1 + l.tax_rate / 100)))}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="cName">Votre nom *</Label>
                <Input id="cName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cPhone">Téléphone *</Label>
                <Input id="cPhone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cEmail">Email (optionnel)</Label>
                <Input id="cEmail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cNotes">Précisions</Label>
                <Textarea id="cNotes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">
                La boutique vous recontactera pour confirmer disponibilité, retrait et paiement (en boutique ou en ligne selon les modalités convenues).
              </p>
            </div>
          </div>
        )}

        {lines.length > 0 && (
          <SheetFooter className="flex-col gap-2 border-t pt-4 sm:flex-col">
            <div className="flex w-full items-center justify-between text-sm">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span>{formatMoney(totals.subtotal_cents)}</span>
            </div>
            <div className="flex w-full items-center justify-between text-sm">
              <span className="text-muted-foreground">TVA</span>
              <span>{formatMoney(totals.tax_cents)}</span>
            </div>
            <div className="flex w-full items-center justify-between text-base font-semibold">
              <span>Total TTC</span>
              <span>{formatMoney(totals.total_cents)}</span>
            </div>
            {step === "cart" ? (
              <Button className="w-full" onClick={() => setStep("checkout")}>Passer commande</Button>
            ) : (
              <>
                <Button className="w-full" onClick={submit} disabled={mutation.isPending}>
                  {mutation.isPending ? "Envoi…" : "Envoyer la demande"}
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep("cart")}>Retour au panier</Button>
              </>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}