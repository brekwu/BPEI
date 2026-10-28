import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/suspension-recours")({
  head: () => ({
    meta: [
      { title: "Suspension et recours — BPEI" },
      { name: "description", content: "Procédure d'appel pour les vendeurs suspendus ou déréférencés." },
      { property: "og:title", content: "Suspension et recours — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Suspension et recours"
      intro="Les vendeurs disposent d'un mécanisme de traitement interne des réclamations concernant les décisions de restriction, suspension ou déréférencement."
      sections={[
        { id: "notification", title: "Notification de la décision", body: "Toute décision de restriction, suspension ou résiliation est notifiée par écrit avec ses motifs, sa portée et les voies de recours. Un préavis raisonnable est respecté sauf urgence." },
        { id: "recours", title: "Exercer un recours", body: "Le vendeur peut contester la décision depuis son espace boutique ou par écrit à l'adresse « support ». Il précise les motifs de contestation et joint les éléments utiles." },
        { id: "delais", title: "Délais de traitement", body: "Nous accusons réception sous 5 jours ouvrés et rendons une décision motivée dans un délai raisonnable en fonction de la complexité du dossier." },
        { id: "mediation", title: "Médiation & juridiction", body: "En cas de désaccord persistant, le vendeur peut recourir à la médiation ou saisir la juridiction compétente conformément aux CGV." },
      ]}
    />
  ),
});