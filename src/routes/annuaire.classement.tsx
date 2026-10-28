import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/annuaire/classement")({
  head: () => ({
    meta: [
      { title: "Méthode de classement — BPEI" },
      { name: "description", content: "Principaux paramètres du classement des boutiques dans l'annuaire." },
      { property: "og:title", content: "Méthode de classement — BPEI" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Méthode de classement de l'annuaire"
      intro="Conformément aux règles européennes de transparence, voici les principaux paramètres qui déterminent le classement par défaut des boutiques."
      sections={[
        { id: "parametres", title: "Paramètres principaux", body: "Pertinence géographique par rapport à la recherche, complétude du profil, présence d'un badge Vérifié, avis clients, réactivité aux messages, respect des règles BPEI." },
        { id: "personnalisation", title: "Personnalisation", body: "L'ordre peut être modifié par l'utilisateur via les filtres et le tri disponibles." },
        { id: "remuneration", title: "Rémunération", body: "Aucun paiement ne permet à ce jour d'améliorer artificiellement le classement par défaut. Toute mise en avant sponsorisée serait signalée comme telle." },
      ]}
    />
  ),
});