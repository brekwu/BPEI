import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/vendeurs/regles")({
  head: () => ({
    meta: [
      { title: "Règles applicables aux vendeurs — BPEI" },
      { name: "description", content: "Obligations d'information, de qualité et de conduite pour les vendeurs BPEI." },
      { property: "og:title", content: "Règles vendeurs — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Règles applicables aux vendeurs"
      sections={[
        { id: "informations", title: "Informations légales", body: "Le vendeur fournit et maintient à jour son identité, son numéro d'immatriculation, ses coordonnées de contact et le service consommateur." },
        { id: "qualite", title: "Qualité du service", body: "Le vendeur respecte les délais annoncés, informe clairement le client, fournit un devis avant tout travail payant et facture conformément à la loi." },
        { id: "conformite", title: "Conformité", body: "Le vendeur s'engage à respecter la réglementation applicable (consommation, garantie légale, protection des données, obligations fiscales)." },
        { id: "sanctions", title: "Sanctions", body: "Tout manquement peut donner lieu à avertissement, restriction, suspension ou résiliation conformément aux CGV." },
      ]}
    />
  ),
});