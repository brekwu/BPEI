import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/pay/politique")({
  head: () => ({
    meta: [
      { title: "Conditions des liens de paiement — BPEI" },
      { name: "description", content: "Cadre juridique des liens de paiement générés depuis BPEI." },
      { property: "og:title", content: "Conditions des liens de paiement — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Conditions des liens de paiement"
      intro="Les liens de paiement BPEI permettent à une boutique d'encaisser un client à distance. Ils sont émis par la boutique, pas par BPEI."
      sections={[
        { id: "emetteur", title: "Émetteur du lien", body: "Le lien est émis par la boutique sous sa propre responsabilité. Le montant, l'objet et le bénéficiaire y figurent." },
        { id: "moyens", title: "Moyens de paiement", body: "Selon la configuration de la boutique : virement bancaire avec référence, carte via Stripe Connect. Les fonds sont crédités directement au compte de la boutique." },
        { id: "confidentialite", title: "Confidentialité", body: "Les données de paiement sont traitées par les prestataires de paiement (banques, Stripe). BPEI ne stocke pas les numéros de carte." },
        { id: "litiges", title: "Litiges", body: "En cas de litige, contacter d'abord la boutique. BPEI facilite la médiation via son service support." },
      ]}
    />
  ),
});