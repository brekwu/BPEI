import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, LogOut, Mail, FileText } from "lucide-react";
import { BETA_END_LABEL } from "@/lib/pricing-plans";

export const Route = createFileRoute("/_authenticated/app/subscription-required")({
  head: () => ({ meta: [{ title: "Abonnement requis — BPEI" }] }),
  component: SubscriptionRequiredPage,
});

function SubscriptionRequiredPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 md:px-6">
      <Card>
        <CardContent className="pt-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="mt-4 text-2xl font-bold">Accès à BPEI Pro requis</h1>
          <p className="mt-4 text-muted-foreground">
            Votre accès gratuit à BPEI Pro a pris fin le {BETA_END_LABEL}.
          </p>
          <p className="mt-3 text-muted-foreground">
            Pour continuer à utiliser BPEI, contactez-nous afin d'activer votre abonnement Pro à <strong className="text-foreground">150 € HT par mois</strong>.
            Vos données (clients, réparations, documents…) sont conservées.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="bg-electric text-electric-foreground hover:bg-electric/90">
              <Link to="/contact"><Mail className="mr-2 h-4 w-4" /> Nous contacter</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/tarifs"><FileText className="mr-2 h-4 w-4" /> Voir les formules</Link>
            </Button>
            <Button variant="ghost" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}