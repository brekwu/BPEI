import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";

export const Route = createFileRoute("/cgv")({
  head: () => ({
    meta: [
      { title: "CGV / CGS — Conditions de vente et de services — BPEI" },
      { name: "description", content: "Conditions générales de vente et de services BPEI : abonnement plateforme et cadre des ventes entre boutiques et clients." },
      { property: "og:title", content: "Conditions générales de vente et de services — BPEI" },
      { property: "og:url", content: "https://bpei.fr/cgv" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/cgv" }],
  }),
  component: Page,
});

function Page() {
  return (
    <LegalPage
      title="Conditions générales de vente et de services (CGV / CGS)"
      intro="Ces conditions distinguent (A) l'abonnement d'une boutique à la plateforme BPEI et (B) le cadre applicable aux ventes entre une boutique et ses clients. BPEI n'est jamais le vendeur des produits et services proposés par les boutiques."
      sections={[
        { id: "a-objet", title: "A. BPEI ↔ Boutique — Objet", body: <p>Les présentes conditions régissent la fourniture de la plateforme BPEI à une boutique cliente : accès aux modules, hébergement des données, support.</p> },
        { id: "a-offres", title: "A. Offres & prix", body: <p>Trois formules sont proposées (Starter, Pro, Réseau) — voir <a className="underline" href="/tarifs">Tarifs</a>. Prix HT hors options, en euros. Facturation mensuelle ou annuelle selon l'offre.</p> },
        { id: "a-paiement", title: "A. Paiement & facturation", body: <p>Pendant la bêta, l'activation et la facturation sont manuelles. Une facture est émise à chaque échéance et adressée à la boutique.</p> },
        { id: "a-duree", title: "A. Durée, renouvellement, résiliation", body: <p>Pendant la bêta, sans engagement. Toute résiliation prend effet à la fin de la période en cours. La boutique peut demander l'export de ses données à tout moment.</p> },
        { id: "a-obligations", title: "A. Obligations", body: <p>BPEI s'engage à un fonctionnement raisonnable du service, à la sécurité des données et à un support par e-mail. La boutique s'engage à un usage conforme aux CGU et à la véracité des informations.</p> },
        { id: "a-fin", title: "A. Fin du contrat", body: <p>À la fin du contrat, les données restent accessibles pendant 30 jours à des fins d'export, puis sont supprimées ou anonymisées selon les obligations légales de conservation.</p> },

        { id: "b-cadre", title: "B. Boutique ↔ Client — Cadre général", body: <p>Chaque boutique demeure vendeur pour les produits et services qu'elle propose à ses clients. Ses propres conditions de vente, garanties, SAV et médiation lui restent applicables. BPEI fournit uniquement l'outil technique.</p> },
        { id: "b-info", title: "B. Informations obligatoires", body: <p>Chaque boutique doit renseigner dans ses paramètres son identité complète, sa TVA le cas échéant, ses conditions de retour/livraison, son SAV et son médiateur de la consommation. Ces informations apparaîtront sur ses documents et sa fiche publique.</p> },
        { id: "b-commande", title: "B. Commande", body: <p>Lorsqu'une commande est confirmée, un récapitulatif détaillé (produit / service, quantité, prix, TVA, total, mode de paiement, retrait / livraison, conditions applicables) est affiché avant validation. Un bouton final indique clairement l'obligation de paiement lorsqu'un paiement est dû.</p> },
        { id: "b-retractation", title: "B. Droit de rétractation", body: <p>Le droit de rétractation s'applique dans les conditions prévues par le Code de la consommation, avec les exceptions légales (biens confectionnés selon les spécifications du consommateur, services pleinement exécutés avec accord express, etc.).</p> },
        { id: "b-garanties", title: "B. Garanties légales", body: <p>Les garanties légales de conformité et des vices cachés s'appliquent. Les modalités précises sont indiquées par chaque boutique dans ses propres CGV.</p> },
        { id: "b-mediation", title: "B. Réclamations & médiation", body: <p>Voir la page <a className="underline" href="/reclamations">Réclamations & médiation</a>. Chaque boutique peut désigner son propre médiateur de la consommation.</p> },
        { id: "b-droit", title: "B. Droit applicable", body: <p>Sauf mention contraire, le droit français s'applique.</p> },
      ]}
    />
  );
}