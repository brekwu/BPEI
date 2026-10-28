import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/annuaire/regles-admission")({
  head: () => ({
    meta: [
      { title: "Règles d'admission à l'annuaire — BPEI" },
      { name: "description", content: "Critères pour figurer parmi les boutiques référencées." },
      { property: "og:title", content: "Règles d'admission — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Règles d'admission à l'annuaire"
      sections={[
        { id: "eligibilite", title: "Éligibilité", body: "Peuvent être référencés les professionnels immatriculés en France ou en UE, exerçant une activité de réparation, revente ou service compatible avec la charte BPEI." },
        { id: "verification", title: "Vérification", body: "Une vérification d'identité, du numéro SIREN et des informations légales est effectuée avant publication." },
        { id: "obligations", title: "Obligations à jour", body: "Le vendeur maintient à jour ses informations légales, tarifs, horaires et modalités de contact." },
        { id: "retrait", title: "Retrait", body: "BPEI peut retirer un référencement en cas de fausse information, plaintes graves ou non-respect des règles de la plateforme." },
      ]}
    />
  ),
});