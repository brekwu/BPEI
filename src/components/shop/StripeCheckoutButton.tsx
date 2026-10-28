import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createInvoiceCheckoutSession } from "@/lib/stripe-checkout.functions";
import { getShopStripeStatus } from "@/lib/stripe-connect.functions";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Link } from "@tanstack/react-router";

/**
 * "Encaisser par carte (Stripe)" button. Hidden gracefully when the shop
 * hasn't finished Stripe onboarding; shows a tooltip pointing to the
 * onboarding page instead.
 */
export function StripeCheckoutButton({ shopId, invoiceId }: { shopId: string; invoiceId: string }) {
  const statusFn = useServerFn(getShopStripeStatus);
  const checkoutFn = useServerFn(createInvoiceCheckoutSession);
  const status = useQuery({
    queryKey: ["shop-stripe-status", shopId],
    queryFn: () => statusFn({ data: { shopId } }),
    staleTime: 60_000,
  });
  const start = useMutation({
    mutationFn: async () => {
      const origin = window.location.origin;
      return checkoutFn({ data: {
        shopId, invoiceId,
        successUrl: `${window.location.href}?stripe=success`,
        cancelUrl: `${window.location.href}?stripe=cancelled`,
      } });
    },
    onSuccess: (res) => { window.location.href = res.url; },
    onError: (e: any) => toast.error(e?.message ?? "Impossible de lancer le paiement carte"),
  });

  if (status.isLoading) return null;
  const ready = !!status.data?.stripe_charges_enabled && !!status.data?.stripe_account_id;

  if (!ready) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="outline">
              <Link to="/app/shop/$shopId/payments/stripe" params={{ shopId }}>
                <CreditCard className="mr-2 h-4 w-4" />Activer paiement carte
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Terminez l'onboarding Stripe pour encaisser par carte.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button onClick={() => start.mutate()} disabled={start.isPending}>
      {start.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
      Encaisser par carte
    </Button>
  );
}