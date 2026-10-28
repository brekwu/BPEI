import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/conditions-beta")({
  head: () => ({
    meta: [
      { title: "Conditions de la bêta — BPEI" },
      { name: "description", content: "Cadre juridique de la phase bêta gratuite de la plateforme BPEI." },
      { property: "og:title", content: "Conditions de la bêta — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Conditions de la bêta"
      intro="Ces conditions s'appliquent à la phase bêta gratuite de BPEI, jusqu'au 31 août 2026."
      sections={[
        { id: "acces", title: "Accès à la bêta", body: "L'accès à la version bêta est proposé gratuitement aux boutiques et professionnels sélectionnés jusqu'au 31/08/2026. BPEI se réserve le droit d'accepter ou refuser une candidature." },
        { id: "service", title: "Niveau de service", body: "La plateforme est fournie « en l'état » pendant la bêta. Des interruptions, régressions ou modifications de fonctionnalités peuvent survenir sans préavis." },
        { id: "donnees", title: "Vos données", body: "Vous restez propriétaire de vos données. Nous mettons en œuvre les mesures raisonnables pour les protéger, sans toutefois garantir zéro perte durant la bêta. Sauvegardez vos exports critiques." },
        { id: "feedback", title: "Retours & suggestions", body: "En tant que bêta-testeur, vous êtes invité à nous transmettre vos retours. BPEI peut librement s'en inspirer pour améliorer le service." },
        { id: "fin", title: "Fin de la bêta", body: "À l'issue de la bêta, la poursuite du service est conditionnée à la souscription d'un abonnement selon les tarifs alors en vigueur." },
      ]}
    />
  ),
});