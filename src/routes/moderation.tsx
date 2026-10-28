import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/moderation")({
  head: () => ({
    meta: [
      { title: "Règles de modération — BPEI" },
      { name: "description", content: "Contenus interdits, mesures possibles et information des utilisateurs." },
      { property: "og:title", content: "Règles de modération — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Règles de modération"
      intro="BPEI met en œuvre une modération proportionnée pour préserver la sécurité et la loyauté de la plateforme."
      sections={[
        { id: "principes", title: "Principes", body: "Nous appliquons nos règles de manière proportionnée, diligente et non discriminatoire, sans surveillance générale des contenus." },
        { id: "contenus", title: "Contenus interdits", body: "Sont notamment interdits : contenus illicites, contrefaçon, incitation à la haine, harcèlement, contenus à caractère sexuel impliquant des mineurs, désinformation dangereuse, tromperie du consommateur, publicités mensongères." },
        { id: "mesures", title: "Mesures possibles", body: "Selon la gravité : avertissement, retrait de contenu, restriction de visibilité, suspension temporaire ou définitive de compte, résiliation d'abonnement." },
        { id: "information", title: "Information des utilisateurs", body: "En cas de mesure, l'utilisateur concerné est informé de la décision, de ses motifs et des voies de recours (page « Suspension et recours »)." },
        { id: "signalements", title: "Signalements", body: "Toute personne peut signaler un contenu via la page « Signaler un contenu ». Les signalements sont examinés dans un délai raisonnable." },
      ]}
    />
  ),
});