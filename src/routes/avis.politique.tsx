import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/avis/politique")({
  head: () => ({
    meta: [
      { title: "Politique des avis — BPEI" },
      { name: "description", content: "Modalités de collecte, vérification, publication et signalement des avis." },
      { property: "og:title", content: "Politique des avis — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Politique des avis"
      intro="BPEI publie les avis dans un souci de transparence pour les consommateurs, dans le respect des règles applicables."
      sections={[
        { id: "collecte", title: "Collecte", body: "Les avis sont recueillis auprès des clients ayant utilisé un service ou effectué un achat vérifiable sur la plateforme." },
        { id: "verification", title: "Vérification", body: "Nous procédons à des contrôles automatisés et, si nécessaire, manuels pour détecter les avis manifestement faux, injurieux ou hors sujet." },
        { id: "publication", title: "Publication", body: "Les avis conformes sont publiés sans contrepartie. Nous ne modifions pas le contenu des avis. Une réponse de la boutique peut être publiée à côté de l'avis." },
        { id: "signalement", title: "Signalement", body: "Tout avis peut être signalé via la page « Signaler un contenu ». Un avis retiré fait l'objet d'une décision motivée transmise à son auteur." },
        { id: "duree", title: "Durée de conservation", body: "Les avis restent affichés tant qu'ils sont pertinents pour l'information des consommateurs, dans les limites légales." },
      ]}
    />
  ),
});