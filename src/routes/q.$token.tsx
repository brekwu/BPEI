import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { publicGetQuote, publicAcceptQuote, publicRefuseQuote } from "@/lib/quotes.public.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { formatMoney, formatDate } from "@/lib/money";
import { BPEILogo } from "@/components/BPEILogo";
import { ShopBrand } from "@/components/shop/ShopBrand";

export const Route = createFileRoute("/q/$token")({
  head: ({ params }) => ({
    meta: [
      { title: "Devis — BPEI" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: `Consultation sécurisée du devis ${params.token.slice(0, 8)}…` },
    ],
  }),
  component: PublicQuote,
});

function PublicQuote() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(publicGetQuote);
  const acceptFn = useServerFn(publicAcceptQuote);
  const refuseFn = useServerFn(publicRefuseQuote);

  const q = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () => getFn({ data: { token } }),
  });

  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");

  const accept = useMutation({
    mutationFn: () => acceptFn({ data: { token, name } }),
    onSuccess: () => { toast.success("Devis accepté — merci !"); qc.invalidateQueries({ queryKey: ["public-quote", token] }); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });
  const refuse = useMutation({
    mutationFn: () => refuseFn({ data: { token, reason: refuseReason || null } }),
    onSuccess: () => { toast.success("Devis refusé"); qc.invalidateQueries({ queryKey: ["public-quote", token] }); setRefuseOpen(false); },
  });

  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement…</div>;
  }
  if (!q.data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-3">
          <BPEILogo variant="dark" />
          <h1 className="text-xl font-semibold">Lien invalide ou expiré</h1>
          <p className="text-sm text-muted-foreground">Ce lien de devis n'est plus valide. Merci de contacter la boutique.</p>
        </div>
      </div>
    );
  }

  const data: any = q.data;
  const quote = data.quote;
  const lines = data.lines as any[];
  const shop = quote.billing_identity_snapshot?.shop;
  const settings = quote.billing_identity_snapshot?.settings;
  const customer = quote.customer_identity_snapshot;
  const isFinal = ["accepted", "refused", "cancelled", "converted", "expired"].includes(quote.status);

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="bg-navy text-navy-foreground py-4 px-6">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <ShopBrand shopId={shop?.id ?? null} shopName={shop?.name ?? null} size={44} variant="light" contrastBackground />
          <div className="text-xs opacity-80">Boutiques Professionnelles d'Experts Informatiques</div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="rounded-md border bg-background p-6">
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Devis</div>
              <div className="text-2xl font-semibold">{quote.quote_number}</div>
              <div className="text-sm mt-1">Émis le {formatDate(quote.issue_date)} · Validité {formatDate(quote.valid_until)}</div>
            </div>
            <div className="text-right text-sm">
              <div className="font-semibold">{shop?.name}</div>
              {settings?.legal_name && <div>{settings.legal_name}</div>}
              {settings?.billing_address && <div>{settings.billing_address}</div>}
              {settings?.billing_postal_code && <div>{settings.billing_postal_code} {settings.billing_city}</div>}
              {settings?.siret && <div>SIRET : {settings.siret}</div>}
              {settings?.vat_number && <div>TVA : {settings.vat_number}</div>}
            </div>
          </div>
          {customer && (
            <div className="mt-6 border-t pt-4 text-sm">
              <div className="text-xs uppercase text-muted-foreground">Destinataire</div>
              <div className="font-medium">
                {customer.customer_type === "business"
                  ? customer.company_name
                  : `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()}
              </div>
              {customer.email && <div>{customer.email}</div>}
              {customer.phone && <div>{customer.phone}</div>}
            </div>
          )}
          {quote.customer_message && (
            <div className="mt-4 text-sm whitespace-pre-wrap border-t pt-4">{quote.customer_message}</div>
          )}
        </div>

        <div className="rounded-md border bg-background p-6">
          <table className="w-full text-sm">
            <thead className="text-left border-b">
              <tr>
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Qté</th>
                <th className="py-2 text-right">PU HT</th>
                <th className="py-2 text-right">TVA</th>
                <th className="py-2 text-right">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b">
                  <td className="py-2">{l.description}</td>
                  <td className="py-2 text-right">{Number(l.quantity)} {l.unit}</td>
                  <td className="py-2 text-right">{formatMoney(l.unit_price_cents, quote.currency)}</td>
                  <td className="py-2 text-right">{l.tax_rate}%</td>
                  <td className="py-2 text-right font-medium">{formatMoney(l.line_total_cents, quote.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span>Sous-total HT</span><span>{formatMoney(quote.subtotal_excluding_tax_cents, quote.currency)}</span></div>
              <div className="flex justify-between"><span>TVA</span><span>{formatMoney(quote.tax_total_cents, quote.currency)}</span></div>
              <div className="flex justify-between text-lg font-semibold border-t pt-2">
                <span>Total TTC</span><span>{formatMoney(quote.total_including_tax_cents, quote.currency)}</span>
              </div>
              {quote.deposit_requested_cents > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground pt-2">
                  <span>Acompte demandé</span><span>{formatMoney(quote.deposit_requested_cents, quote.currency)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {quote.terms_snapshot && (
          <div className="rounded-md border bg-background p-6 text-sm">
            <div className="font-semibold mb-2">Conditions</div>
            <div className="whitespace-pre-wrap text-muted-foreground">{quote.terms_snapshot}</div>
          </div>
        )}

        {isFinal ? (
          <div className="rounded-md border bg-background p-6 text-center">
            <div className="text-lg font-medium">
              {quote.status === "accepted" && "Devis accepté ✓"}
              {quote.status === "converted" && "Devis accepté et facturé ✓"}
              {quote.status === "refused" && "Devis refusé"}
              {quote.status === "cancelled" && "Devis annulé"}
              {quote.status === "expired" && "Devis expiré"}
            </div>
            {quote.accepted_by_name && (
              <div className="text-sm text-muted-foreground mt-2">Signé par {quote.accepted_by_name}</div>
            )}
          </div>
        ) : (
          <div className="rounded-md border bg-background p-6 space-y-4">
            <div className="font-semibold">Accepter ce devis</div>
            <div>
              <Label>Votre nom complet</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom NOM" />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="ok" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
              <label htmlFor="ok" className="text-sm">
                J'accepte le devis et les conditions associées. Cette acceptation vaut engagement contractuel.
              </label>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" onClick={() => setRefuseOpen((v) => !v)}>Refuser</Button>
              <Button onClick={() => accept.mutate()} disabled={!name || !accepted || accept.isPending}>
                {accept.isPending ? "Envoi…" : "Accepter le devis"}
              </Button>
            </div>
            {refuseOpen && (
              <div className="border-t pt-4 space-y-2">
                <Label>Motif du refus (optionnel)</Label>
                <Textarea value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} />
                <div className="flex justify-end">
                  <Button variant="destructive" onClick={() => refuse.mutate()}>Confirmer le refus</Button>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Cette acceptation constitue une preuve d'accord (nom, date, adresse IP, navigateur).
              Elle ne remplace pas une signature qualifiée par un prestataire certifié.
            </p>
          </div>
        )}
      </main>
      <footer className="text-center text-xs text-muted-foreground py-6">
        Document sécurisé — Réseau BPEI
      </footer>
    </div>
  );
}