import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/annuaire/badge-verifie")({
  head: () => ({
    meta: [
      { title: "Badge Vérifié BPEI — BPEI" },
      { name: "description", content: "Ce que garantit et ne garantit pas le badge Vérifié BPEI." },
      { property: "og:title", content: "Badge Vérifié BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Badge Vérifié BPEI"
      sections={[
        { id: "criteres", title: "Ce que le badge indique", body: "Le badge Vérifié atteste que la boutique a fourni ses informations légales, que celles-ci ont été contrôlées et qu'elle respecte la charte BPEI au moment de la vérification." },
        { id: "limites", title: "Ce que le badge n'est pas", body: "Le badge ne constitue pas une certification indépendante ni une garantie commerciale. Il ne garantit pas la qualité individuelle de chaque prestation." },
        { id: "revocation", title: "Révocation", body: "BPEI peut suspendre ou retirer le badge en cas de manquement, plaintes graves ou information devenue inexacte." },
      ]}
    />
  ),
});