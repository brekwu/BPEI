import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/conditions-abonnement")({
  head: () => ({
    meta: [
      { title: "Conditions des abonnements — BPEI" },
      { name: "description", content: "Durée, résiliation, engagement et essai des abonnements BPEI." },
      { property: "og:title", content: "Conditions des abonnements — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Conditions des abonnements BPEI"
      intro="Ces conditions encadrent les abonnements Starter, Pro, Réseau et offres associées. Elles complètent les CGV."
      sections={[
        { id: "offres", title: "Offres et prix", body: "Les prix, engagements et fonctionnalités des offres sont détaillés sur la page Tarifs. Ils s'appliquent à la souscription et sont susceptibles d'évoluer, sans effet rétroactif sur les abonnements en cours." },
        { id: "engagement", title: "Durée & engagement", body: "Sauf mention contraire, les abonnements sont mensuels sans engagement, ou annuels avec engagement d'un an. La tacite reconduction s'applique dans les limites prévues par la loi." },
        { id: "essai", title: "Essai & bêta", body: "Pendant la phase bêta, l'accès est gratuit et sans engagement jusqu'au 31 août 2026." },
        { id: "resiliation", title: "Résiliation", body: "Vous pouvez résilier à tout moment depuis votre espace boutique ; l'accès reste ouvert jusqu'à la fin de la période payée. Aucun remboursement n'est effectué pour la période entamée, sauf disposition légale contraire." },
        { id: "paiement", title: "Paiement", body: "Les abonnements sont réglés par prélèvement, virement ou carte selon la méthode choisie. En cas d'échec, l'accès peut être suspendu après relance." },
        { id: "modifications", title: "Modification des conditions", body: "Toute évolution est notifiée avec un préavis raisonnable. À défaut d'acceptation, vous pouvez résilier sans frais." },
      ]}
    />
  ),
});