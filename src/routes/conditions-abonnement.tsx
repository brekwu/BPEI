import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/conditions-abonnement")({
  head: () => ({
    meta: [
      { title: "Conditions des abonnements — BPEI" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Durée, résiliation, engagement et essai des abonnements BPEI." },
      { property: "og:title", content: "Conditions des abonnements — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Conditions des abonnements BPEI — version historique"
      intro="Document historique relatif aux offres d’abonnement BPEI. Les modalités actuelles de la collaboration avec des techniciens indépendants sont communiquées avant tout engagement."
      sections={[
        { id: "offres", title: "Offres et prix", body: "Les prix, engagements et fonctionnalités des offres sont détaillés sur la page Tarifs. Ils s'appliquent à la souscription et sont susceptibles d'évoluer, sans effet rétroactif sur les abonnements en cours." },
        { id: "engagement", title: "Durée & engagement", body: "Sauf mention contraire, les abonnements sont mensuels sans engagement, ou annuels avec engagement d'un an. La tacite reconduction s'applique dans les limites prévues par la loi." },
        { id: "essai", title: "Essai & bêta", body: "La période bêta gratuite mentionnée dans ces conditions a pris fin le 31 août 2026." },
        { id: "resiliation", title: "Résiliation", body: "Vous pouvez résilier à tout moment depuis votre espace boutique ; l'accès reste ouvert jusqu'à la fin de la période payée. Aucun remboursement n'est effectué pour la période entamée, sauf disposition légale contraire." },
        { id: "paiement", title: "Paiement", body: "Les abonnements sont réglés par prélèvement, virement ou carte selon la méthode choisie. En cas d'échec, l'accès peut être suspendu après relance." },
        { id: "modifications", title: "Modification des conditions", body: "Toute évolution est notifiée avec un préavis raisonnable. À défaut d'acceptation, vous pouvez résilier sans frais." },
      ]}
    />
  ),
});