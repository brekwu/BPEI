import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatDate } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, CheckCircle2, XCircle, Clock, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createPaymentLinkCheckoutSession } from "@/lib/stripe-checkout.functions";

export const Route = createFileRoute("/pay/$token")({
  head: () => ({
    meta: [
      { title: "Paiement — BPEI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PayPage,
});

type PublicLink = {
  id: string; status: string; amount_cents: number; currency: string;
  label: string | null; bank_reference: string; expires_at: string | null;
  accepted_methods: string[];
  shop_id: string; shop_name: string;
  shop_iban: string | null; shop_bic: string | null;
  shop_holder: string | null; shop_transfer_instructions: string | null;
  shop_stripe_ready: boolean;
};

function PayPage() {
  const { token } = Route.useParams();
  const [link, setLink] = useState<PublicLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_payment_link_public", { _token: token });
      if (error || !data || (data as any[]).length === 0) { setNotFound(true); setLoading(false); return; }
      setLink((data as any[])[0] as PublicLink);
      setLoading(false);
    })();
  }, [token]);

  function copy(v: string) {
    navigator.clipboard.writeText(v);
    toast.success("Copié");
  }

  if (loading) return <div className="mx-auto max-w-lg p-8 text-sm text-muted-foreground">Chargement…</div>;
  if (notFound || !link) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Card>
          <CardHeader><CardTitle>Lien introuvable</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ce lien de paiement n'existe pas ou a été supprimé.
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusMeta: Record<string, { icon: any; label: string; tone: string }> = {
    pending: { icon: Clock, label: "En attente de paiement", tone: "text-amber-600" },
    paid: { icon: CheckCircle2, label: "Paiement reçu", tone: "text-emerald-600" },
    expired: { icon: XCircle, label: "Lien expiré", tone: "text-red-600" },
    cancelled: { icon: XCircle, label: "Lien annulé", tone: "text-red-600" },
  };
  const s = statusMeta[link.status] ?? statusMeta.pending;
  const StatusIcon = s.icon;
  const canPay = link.status === "pending";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 sm:p-10">
      <div className="text-center space-y-1">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{link.shop_name}</div>
        <h1 className="font-display text-3xl font-bold">Demande de paiement</h1>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Montant</div>
              <div className="text-4xl font-bold tabular-nums">{formatMoney(link.amount_cents, link.currency)}</div>
            </div>
            <div className={`flex items-center gap-2 text-sm font-medium ${s.tone}`}>
              <StatusIcon className="h-5 w-5" /> {s.label}
            </div>
          </div>
          {link.label && <div className="text-sm text-muted-foreground">{link.label}</div>}
          {link.expires_at && canPay && (
            <div className="text-xs text-muted-foreground">Valable jusqu'au {formatDate(link.expires_at)}</div>
          )}
        </CardContent>
      </Card>

      {canPay && link.accepted_methods.includes("bank_transfer") && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Payer par virement bancaire</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {link.shop_iban ? (
              <>
                <p className="text-muted-foreground">
                  Effectuez un virement avec les coordonnées ci-dessous. <strong>Indiquez impérativement la référence</strong> pour que votre paiement soit rattaché automatiquement.
                </p>
                <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
                  <BankRow label="Bénéficiaire" value={link.shop_holder ?? link.shop_name} onCopy={copy} />
                  <BankRow label="IBAN" value={link.shop_iban} onCopy={copy} mono />
                  {link.shop_bic && <BankRow label="BIC" value={link.shop_bic} onCopy={copy} mono />}
                  <BankRow label="Référence" value={link.bank_reference} onCopy={copy} mono highlight />
                  <BankRow label="Montant" value={(link.amount_cents / 100).toFixed(2) + " " + link.currency} onCopy={copy} />
                </div>
                {link.shop_transfer_instructions && (
                  <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                    {link.shop_transfer_instructions}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Le rapprochement est effectué manuellement par la boutique dès réception du virement.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">
                La boutique n'a pas encore renseigné ses coordonnées bancaires. Contactez-la directement pour organiser le règlement.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {canPay && link.shop_stripe_ready && (
        <StripePayCard token={token} amountCents={link.amount_cents} currency={link.currency} />
      )}

      <div className="text-center text-xs text-muted-foreground">
        Cette page est sécurisée par BPEI.
      </div>
    </div>
  );
}

function BankRow({ label, value, onCopy, mono, highlight }: {
  label: string; value: string; onCopy: (v: string) => void; mono?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`truncate ${mono ? "font-mono" : ""} ${highlight ? "font-semibold text-electric" : ""}`}>{value}</div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onCopy(value)}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StripePayCard({ token, amountCents, currency }: { token: string; amountCents: number; currency: string }) {
  const checkoutFn = useServerFn(createPaymentLinkCheckoutSession);
  const [pending, setPending] = useState(false);
  async function pay() {
    setPending(true);
    try {
      const origin = window.location.origin;
      const res = await checkoutFn({ data: {
        token,
        successUrl: `${origin}/pay/${token}?stripe=success`,
        cancelUrl: `${origin}/pay/${token}?stripe=cancelled`,
      } });
      window.location.href = res.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Impossible de lancer le paiement carte");
      setPending(false);
    }
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Payer par carte bancaire</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Paiement 100&nbsp;% sécurisé par Stripe. Vous serez redirigé vers une page de paiement sécurisée.
        </p>
        <Button onClick={pay} disabled={pending} className="w-full sm:w-auto">
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
          Payer {formatMoney(amountCents, currency)} par carte
        </Button>
      </CardContent>
    </Card>
  );
}