import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/commandes/role-bpei")({
  head: () => ({
    meta: [
      { title: "Rôle de BPEI dans les commandes — BPEI" },
      { name: "description", content: "Qui est vendeur et qui est intermédiaire dans les commandes et les paiements." },
      { property: "og:title", content: "Rôle de BPEI dans les commandes" },
    ],
  }),
  component: () => (
    <LegalPage
      title="Rôle de BPEI dans les commandes"
      intro="BPEI est un fournisseur d'outils et une place de mise en relation. BPEI n'est ni vendeur ni réparateur des services proposés par les boutiques."
      sections={[
        { id: "vendeur", title: "Le vendeur/réparateur", body: "Chaque commande, devis, réparation ou facture est établie par la boutique indépendante identifiée sur le document. La responsabilité contractuelle vis-à-vis du client incombe à cette boutique." },
        { id: "paiement", title: "Encaissement", body: "Les paiements par lien BPEI (virement, carte via Stripe Connect) sont encaissés directement par la boutique. BPEI n'est pas payeur ni séquestre." },
        { id: "reclamations", title: "Réclamations", body: "Les réclamations relatives à un service ou un produit sont d'abord adressées à la boutique. BPEI peut faciliter la médiation via son service support." },
        { id: "conformite", title: "Obligations de la boutique", body: "La boutique reste tenue de toutes les obligations légales du vendeur/prestataire (information précontractuelle, garantie, facturation, TVA)." },
      ]}
    />
  ),
});