// Source unique des formules et fonctionnalités BPEI.
// Toute modification tarif/module se fait ici.
// 2 univers : boutiques physiques (3 plans) et indépendants à domicile (2 plans).

export const BETA_END_ISO = "2026-08-31T23:59:59+02:00";
export const BETA_END_LABEL = "31 août 2026";

export type Profile = "boutique" | "independant";

export type PlanKey =
  | "shop_essential"
  | "shop_pro"
  | "shop_network"
  | "independent_intervention"
  | "independent_partner";

export type FeatureStatus = "available" | "beta" | "coming_soon" | "on_demand";
export type PlanInclusion = "included" | "not_included" | "limited" | "on_demand";

export interface Plan {
  key: PlanKey;
  profile: Profile;
  name: string;
  tagline: string;
  priceLabel: string;
  priceSubLabel?: string;
  betaLabel?: string;
  badge?: string;
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
  hidePrice?: boolean;
  disclaimer?: string;
}

export const PLANS: Plan[] = [
  // Univers boutiques
  {
    key: "shop_essential",
    profile: "boutique",
    name: "BPEI Boutique Essentiel",
    tagline: "L'essentiel pour organiser et professionnaliser une petite boutique informatique.",
    priceLabel: "79 € HT / mois",
    priceSubLabel: "Après la bêta",
    betaLabel: `Gratuit jusqu'au ${BETA_END_LABEL}`,
    ctaLabel: "Demander un accès bêta",
    ctaHref: "/rejoindre",
  },
  {
    key: "shop_pro",
    profile: "boutique",
    name: "BPEI Boutique Pro",
    tagline: "La solution complète pour gérer une boutique, son équipe, son stock et ses opérations.",
    priceLabel: "150 € HT / mois",
    priceSubLabel: "Après la bêta",
    betaLabel: `Gratuit jusqu'au ${BETA_END_LABEL}`,
    badge: "La plus choisie",
    ctaLabel: "Demander un accès bêta",
    ctaHref: "/rejoindre",
    highlight: true,
  },
  {
    key: "shop_network",
    profile: "boutique",
    name: "BPEI Réseau",
    tagline: "Pour les entreprises disposant de plusieurs établissements ou souhaitant une organisation centralisée.",
    priceLabel: "Sur devis",
    priceSubLabel: "Certaines fonctions sont encore en développement.",
    ctaLabel: "Contacter BPEI",
    ctaHref: "/contact",
    hidePrice: true,
  },
  // Univers indépendants
  {
    key: "independent_intervention",
    profile: "independant",
    name: "BPEI Intervention",
    tagline: "Pour les professionnels travaillant seuls et intervenant directement chez leurs clients.",
    priceLabel: "49 € HT / mois",
    priceSubLabel: "Après la bêta",
    betaLabel: `Gratuit jusqu'au ${BETA_END_LABEL}`,
    ctaLabel: "Demander un accès bêta",
    ctaHref: "/rejoindre",
  },
  {
    key: "independent_partner",
    profile: "independant",
    name: "BPEI Partenaire Premium",
    tagline: "Pour les indépendants souhaitant développer leur visibilité et travailler avec les boutiques du réseau BPEI.",
    priceLabel: "99 € HT / mois",
    priceSubLabel: "Après la bêta",
    betaLabel: `Gratuit jusqu'au ${BETA_END_LABEL}`,
    badge: "Développez votre activité",
    ctaLabel: "Demander un accès bêta",
    ctaHref: "/rejoindre",
    highlight: true,
    disclaimer:
      "L'abonnement Partenaire Premium donne accès aux opportunités proposées par le réseau. Il ne garantit pas automatiquement une mission, un contrat, un chiffre d'affaires ou une exclusivité territoriale.",
  },
];

// Inclusion par plan pour chaque fonctionnalité.
type PlanInclusionMap = Partial<Record<PlanKey, PlanInclusion>>;
type PlanTextMap = Partial<Record<PlanKey, string>>;

export interface Feature {
  key: string;
  name: string;
  summary: string;
  details: string;
  status: FeatureStatus;
  profile: Profile; // à quel univers ce comparateur appartient
  plans: PlanInclusionMap;
  /** Précision concrète et exacte quand le statut d'inclusion d'un plan est "limited" ou "on_demand". */
  limits?: PlanTextMap;
}

export const FEATURES: Feature[] = [
  // ===== Boutiques =====
  { key: "clients", name: "Clients", summary: "Fiches clients & historique.",
    details: "Coordonnées, historique, appareils, devis et factures rattachés.", status: "available", profile: "boutique",
    plans: { shop_essential: "included", shop_pro: "included", shop_network: "included" } },
  { key: "devices", name: "Appareils", summary: "Suivi des appareils confiés.",
    details: "Marque, modèle, numéro de série, historique.", status: "available", profile: "boutique",
    plans: { shop_essential: "included", shop_pro: "included", shop_network: "included" } },
  { key: "repairs", name: "Réparations", summary: "Dossiers complets.",
    details: "Diagnostic, statuts, notes, pièces, communication, timeline.", status: "available", profile: "boutique",
    plans: { shop_essential: "limited", shop_pro: "included", shop_network: "included" },
    limits: { shop_essential: "Dossiers avec diagnostic, statuts, notes et timeline. Les pièces liées au stock et la communication multi-canal sont réservées au Pro." } },
  { key: "appointments", name: "Rendez-vous", summary: "Prise de RDV en ligne.",
    details: "Créneaux configurables, réservation depuis la page publique.", status: "available", profile: "boutique",
    plans: { shop_essential: "included", shop_pro: "included", shop_network: "included" } },
  { key: "quotes", name: "Devis", summary: "Devis PDF avec TVA.",
    details: "Numérotation, PDF, acceptation en ligne, conversion en facture.", status: "available", profile: "boutique",
    plans: { shop_essential: "limited", shop_pro: "included", shop_network: "included" },
    limits: { shop_essential: "Devis PDF numérotés avec TVA. L'acceptation en ligne et la conversion automatique en facture sont réservées au Pro." } },
  { key: "invoices", name: "Factures", summary: "Facturation numérotée.",
    details: "Numérotation continue, TVA multi-taux, PDF, verrouillage.", status: "available", profile: "boutique",
    plans: { shop_essential: "limited", shop_pro: "included", shop_network: "included" },
    limits: { shop_essential: "Facturation numérotée avec PDF et verrouillage. La TVA multi-taux avancée et les avoirs sont réservés au Pro." } },
  { key: "public_page", name: "Page publique", summary: "Fiche BPEI dédiée.",
    details: "Coordonnées, horaires, catalogue, avis, prise de RDV.", status: "available", profile: "boutique",
    plans: { shop_essential: "included", shop_pro: "included", shop_network: "included" } },
  { key: "portal", name: "Portail client", summary: "Espace personnel client.",
    details: "Le client consulte ses réparations, devis, factures et RDV.", status: "available", profile: "boutique",
    plans: { shop_essential: "included", shop_pro: "included", shop_network: "included" } },
  { key: "users_shop", name: "Utilisateurs", summary: "Employés & techniciens.",
    details: "Nombre d'utilisateurs autorisés à se connecter à l'espace boutique.", status: "available", profile: "boutique",
    plans: { shop_essential: "limited", shop_pro: "included", shop_network: "included" },
    limits: { shop_essential: "2 utilisateurs (patron + 1 employé)." } },
  { key: "stock", name: "Stock", summary: "Suivi quantités & seuils.",
    details: "Réservations, quarantaine, seuils de réapprovisionnement.", status: "available", profile: "boutique",
    plans: { shop_essential: "limited", shop_pro: "included", shop_network: "included" },
    limits: { shop_essential: "Suivi des quantités et seuils. Les réservations, la quarantaine et les mouvements avancés sont réservés au Pro." } },
  { key: "suppliers", name: "Fournisseurs", summary: "Fournisseurs & achats.",
    details: "Bons de commande, réception, historique par fournisseur.", status: "available", profile: "boutique",
    plans: { shop_essential: "not_included", shop_pro: "included", shop_network: "included" } },
  { key: "purchasing", name: "Commandes d'achat", summary: "Bons de commande complets.",
    details: "Émission, réception, comparateur fournisseurs.", status: "available", profile: "boutique",
    plans: { shop_essential: "not_included", shop_pro: "included", shop_network: "included" } },
  { key: "cash_register", name: "Caisse", summary: "Journal de caisse.",
    details: "Encaissement rapide, journal, clôtures — livraison progressive.", status: "beta", profile: "boutique",
    plans: { shop_essential: "not_included", shop_pro: "included", shop_network: "included" } },
  { key: "stats_shop", name: "Statistiques", summary: "Indicateurs d'activité.",
    details: "Suivi de l'activité de la boutique.", status: "available", profile: "boutique",
    plans: { shop_essential: "limited", shop_pro: "included", shop_network: "included" },
    limits: { shop_essential: "Indicateurs de base : chiffre d'affaires, RDV, réparations en cours. Les analyses détaillées et exports sont réservés au Pro." } },
  { key: "partners_shop", name: "Partenariats", summary: "Réseau d'indépendants.",
    details: "Publier des opportunités et travailler avec des indépendants vérifiés.", status: "beta", profile: "boutique",
    plans: { shop_essential: "not_included", shop_pro: "included", shop_network: "included" } },
  { key: "multi_location", name: "Multi-établissements", summary: "Plusieurs boutiques.",
    details: "Vue centralisée, permissions par établissement.", status: "on_demand", profile: "boutique",
    plans: { shop_essential: "not_included", shop_pro: "not_included", shop_network: "included" } },
  { key: "support_shop", name: "Accompagnement", summary: "Support prioritaire.",
    details: "Assistance BPEI selon la formule.", status: "on_demand", profile: "boutique",
    plans: { shop_essential: "not_included", shop_pro: "limited", shop_network: "included" },
    limits: { shop_pro: "Support standard par email. L'accompagnement prioritaire et les intégrations personnalisées sont réservés au Réseau." } },

  // ===== Indépendants =====
  { key: "i_clients", name: "Clients", summary: "Fiches clients complètes.",
    details: "Coordonnées, historique, appareils, interventions.", status: "available", profile: "independant",
    plans: { independent_intervention: "included", independent_partner: "included" } },
  { key: "i_devices", name: "Appareils", summary: "Historique par appareil.",
    details: "Marque, modèle, numéro de série, historique d'intervention.", status: "available", profile: "independant",
    plans: { independent_intervention: "included", independent_partner: "included" } },
  { key: "i_interventions", name: "Interventions à domicile", summary: "Rapports terrain.",
    details: "Photos avant/après, signature client, rapport d'intervention.", status: "available", profile: "independant",
    plans: { independent_intervention: "included", independent_partner: "included" } },
  { key: "i_agenda", name: "Agenda & RDV", summary: "Planification.",
    details: "Prise de rendez-vous, agenda hebdomadaire, itinéraire.", status: "available", profile: "independant",
    plans: { independent_intervention: "included", independent_partner: "included" } },
  { key: "i_zones", name: "Zones d'intervention", summary: "Villes, codes postaux, rayon.",
    details: "Définition des secteurs géographiques couverts.", status: "available", profile: "independant",
    plans: { independent_intervention: "limited", independent_partner: "included" },
    limits: { independent_intervention: "1 zone d'intervention principale (villes, codes postaux, rayon). Les zones secondaires sont réservées au Partenaire Premium." } },
  { key: "i_travel_fees", name: "Frais de déplacement", summary: "Facturation des déplacements.",
    details: "Barème kilométrique, forfait, seuil de gratuité.", status: "available", profile: "independant",
    plans: { independent_intervention: "included", independent_partner: "included" } },
  { key: "i_quotes", name: "Devis & factures", summary: "Devis, factures, acomptes.",
    details: "PDF, TVA, verrouillage, acomptes, reçus.", status: "available", profile: "independant",
    plans: { independent_intervention: "included", independent_partner: "included" } },
  { key: "i_signature", name: "Signature client", summary: "Signature sur intervention.",
    details: "Signature client sur le rapport d'intervention.", status: "available", profile: "independant",
    plans: { independent_intervention: "included", independent_partner: "included" } },
  { key: "i_public_page", name: "Page publique (sans adresse)", summary: "Vitrine sans domicile.",
    details: "L'adresse administrative reste strictement privée.", status: "available", profile: "independant",
    plans: { independent_intervention: "included", independent_partner: "included" } },
  { key: "i_stock", name: "Stock mobile", summary: "Stock mobile simplifié.",
    details: "Suivi des pièces emportées en intervention.", status: "available", profile: "independant",
    plans: { independent_intervention: "limited", independent_partner: "included" },
    limits: { independent_intervention: "Suivi simplifié des pièces courantes. La gestion avancée (seuils, mouvements détaillés) est réservée au Partenaire Premium." } },
  { key: "i_users", name: "Utilisateurs", summary: "Nombre de comptes autorisés.",
    details: "Nombre d'utilisateurs autorisés à se connecter à l'espace indépendant.", status: "available", profile: "independant",
    plans: { independent_intervention: "limited", independent_partner: "included" },
    limits: { independent_intervention: "1 utilisateur (l'indépendant).", independent_partner: "Jusqu'à 2 utilisateurs." } },
  { key: "i_priority_visibility", name: "Visibilité prioritaire", summary: "Meilleur classement.",
    details: "Visibilité renforcée dans les recherches BPEI (Premium).", status: "available", profile: "independant",
    plans: { independent_intervention: "not_included", independent_partner: "included" } },
  { key: "i_opportunities", name: "Opportunités boutiques", summary: "Missions du réseau.",
    details: "Consulter les missions publiées par les boutiques Pro/Réseau.", status: "beta", profile: "independant",
    plans: { independent_intervention: "not_included", independent_partner: "included" } },
  { key: "i_applications", name: "Candidatures aux missions", summary: "Candidater.",
    details: "Postuler avec message, tarif proposé, disponibilités.", status: "beta", profile: "independant",
    plans: { independent_intervention: "not_included", independent_partner: "included" } },
  { key: "i_agreements", name: "Accords de partenariat", summary: "Contrats encadrés.",
    details: "Récapitulatif PDF, workflow d'acceptation, exclusivités limitées.", status: "beta", profile: "independant",
    plans: { independent_intervention: "not_included", independent_partner: "included" } },
  { key: "i_verified_badge", name: "Éligibilité badge vérifié", summary: "Badge Partenaire BPEI vérifié.",
    details: "Après vérification manuelle par BPEI. Séparé de l'abonnement.", status: "on_demand", profile: "independant",
    plans: { independent_intervention: "not_included", independent_partner: "included" } },
  { key: "i_support", name: "Support prioritaire", summary: "Assistance renforcée.",
    details: "Accompagnement dédié pour les partenaires Premium.", status: "on_demand", profile: "independant",
    plans: { independent_intervention: "not_included", independent_partner: "included" } },
];

export const INCLUSION_LABEL: Record<PlanInclusion, string> = {
  included: "Inclus",
  not_included: "Non inclus",
  limited: "Version simplifiée",
  on_demand: "Sur demande",
};

/**
 * Rend le texte affichable pour une cellule (feature, plan) du comparateur.
 * Pour "limited" et "on_demand", utilise la précision `limits[plan]` si définie.
 */
export function getPlanCellText(
  feature: Feature,
  planKey: PlanKey,
): { status: PlanInclusion; label: string; detail?: string } {
  const status = (feature.plans[planKey] ?? "not_included") as PlanInclusion;
  const detail = feature.limits?.[planKey];
  if (status === "limited") {
    return { status, label: INCLUSION_LABEL.limited, detail };
  }
  if (status === "on_demand") {
    return { status, label: INCLUSION_LABEL.on_demand, detail };
  }
  return { status, label: INCLUSION_LABEL[status] };
}

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  available: "Disponible",
  beta: "Bêta",
  coming_soon: "Prochainement",
  on_demand: "Sur demande",
};

export const STATUS_CLASS: Record<FeatureStatus, string> = {
  available: "bg-emerald-100 text-emerald-800",
  beta: "bg-amber-100 text-amber-800",
  coming_soon: "bg-slate-100 text-slate-700",
  on_demand: "bg-sky-100 text-sky-800",
};

export const PLAN_LABEL: Record<PlanKey, string> = {
  shop_essential: "Essentiel",
  shop_pro: "Pro",
  shop_network: "Réseau",
  independent_intervention: "Intervention",
  independent_partner: "Partenaire Premium",
};

export const BUSINESS_TYPE_LABEL: Record<
  "physical_shop" | "mobile_independent" | "hybrid_business" | "multi_location_network",
  string
> = {
  physical_shop: "Boutique physique",
  mobile_independent: "Indépendant à domicile",
  hybrid_business: "Activité hybride (boutique + interventions)",
  multi_location_network: "Réseau multi-établissements",
};