import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({ profil: z.string().optional() });

export const Route = createFileRoute("/tarifs")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Conditions commerciales — BPEI" },
      { name: "description", content: "Les modalités commerciales du réseau de partenaires indépendants BPEI sont communiquées individuellement avant toute collaboration." },
      { property: "og:url", content: "https://bpei.fr/tarifs" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/tarifs" }],
  }),
  component: TarifsPage,
});

function TarifsPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-4xl px-4 py-20 md:px-6">
        <h1 className="text-3xl font-bold md:text-5xl">Conditions commerciales BPEI</h1>
        <p className="mt-6 text-lg text-muted-foreground">BPEI développe son réseau de techniciens indépendants. Les modalités financières des partenariats et les éventuels tarifs de prestations sont en cours de définition.</p>
        <div className="mt-8 rounded-xl border bg-secondary/30 p-6">
          <h2 className="text-xl font-semibold">Avant tout engagement</h2>
          <p className="mt-3 text-sm text-muted-foreground">Les conditions applicables seront communiquées par écrit, et devront être acceptées, avant toute collaboration ou prestation payante. Une candidature ne déclenche aucun abonnement ni prélèvement.</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><Link to="/devenir-partenaire">Devenir partenaire indépendant</Link></Button>
          <Button asChild variant="outline"><Link to="/contact">Contacter BPEI</Link></Button>
        </div>
      </section>
    </PublicShell>
  );
}
