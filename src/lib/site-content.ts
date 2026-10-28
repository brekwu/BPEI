// Central content configuration for the BPEI public site.
// Update pricing / contact info here — pages read from this file.

export const SITE = {
  name: "BPEI",
  fullName: "Boutiques Professionnelles d'Experts Informatiques",
  tagline: "Le réseau des boutiques informatiques indépendantes.",
  betaBanner: "BPEI constitue son réseau de partenaires indépendants. La disponibilité des interventions varie selon la zone.",
  legalUpdatedAt: "16 juillet 2026",
  contact: {
    // These are configured by the platform admin. Leave null until known — pages will hide the row.
    email: null as string | null,
    phone: null as string | null,
    address: null as string | null,
  },
  legal: {
    // Fill via administration; if null the mentions-legales page shows a "to configure" banner.
    editorName: null as string | null,
    legalForm: null as string | null,
    address: null as string | null,
    siren: null as string | null,
    rcs: null as string | null,
    vat: null as string | null,
    publicationDirector: null as string | null,
    hostName: "Cloudflare Workers (via Lovable Cloud)",
    hostAddress: null as string | null,
  },
  mediator: {
    // Fill via administration.
    name: null as string | null,
    website: null as string | null,
    address: null as string | null,
    scope: null as string | null,
  },
};

export type AvailabilityStatus = "available" | "beta" | "coming";
export const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  available: "Disponible",
  beta: "En bêta",
  coming: "Prochainement",
};
export const STATUS_CLASS: Record<AvailabilityStatus, string> = {
  available: "bg-emerald-100 text-emerald-800",
  beta: "bg-amber-100 text-amber-800",
  coming: "bg-muted text-muted-foreground",
};

export interface PricingPlan {
  key: "starter" | "pro" | "reseau";
  name: string;
  tagline: string;
  monthlyCents: number;
  yearlyCents: number; // per month equivalent
  currency: "EUR";
  users: string;
  establishments: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

export const PLANS: PricingPlan[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "Pour une boutique indépendante qui démarre sur BPEI.",
    monthlyCents: 4900,
    yearlyCents: 4200,
    currency: "EUR",
    users: "Jusqu'à 2 utilisateurs",
    establishments: "1 établissement",
    features: [
      "Fiche boutique publique",
      "Clients, appareils, réparations",
      "Rendez-vous en ligne",
      "Devis & factures PDF",
      "Portail client & suivi public",
      "Support par e-mail",
    ],
    cta: "Demander une présentation",
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "Toute la gestion : stocks, achats, fournisseurs, PDF avancés.",
    monthlyCents: 14900,
    yearlyCents: 12900,
    currency: "EUR",
    users: "Jusqu'à 8 utilisateurs",
    establishments: "1 établissement",
    features: [
      "Toutes les fonctions Starter",
      "Stock, mouvements & inventaire",
      "Fournisseurs & bons de commande",
      "Réapprovisionnement guidé",
      "Quarantaine, écarts de prix",
      "Support prioritaire",
    ],
    cta: "Demander une présentation",
    highlight: true,
  },
  {
    key: "reseau",
    name: "Réseau",
    tagline: "Multi-établissements, statistiques consolidées, rôles avancés.",
    monthlyCents: 29900,
    yearlyCents: 26900,
    currency: "EUR",
    users: "Utilisateurs illimités",
    establishments: "Jusqu'à 10 établissements",
    features: [
      "Toutes les fonctions Pro",
      "Rôles réseau & permissions",
      "Statistiques consolidées",
      "Accompagnement dédié",
      "Onboarding accompagné",
    ],
    cta: "Nous contacter",
  },
];

export const COMPARE_ROWS: Array<{ feature: string; starter: string; pro: string; reseau: string; status: AvailabilityStatus }> = [
  { feature: "Fiche boutique publique", starter: "✓", pro: "✓", reseau: "✓", status: "available" },
  { feature: "Clients & appareils", starter: "✓", pro: "✓", reseau: "✓", status: "available" },
  { feature: "Réparations & rendez-vous", starter: "✓", pro: "✓", reseau: "✓", status: "available" },
  { feature: "Devis, factures, avoirs", starter: "✓", pro: "✓", reseau: "✓", status: "available" },
  { feature: "Portail client", starter: "✓", pro: "✓", reseau: "✓", status: "available" },
  { feature: "Stock & mouvements", starter: "—", pro: "✓", reseau: "✓", status: "available" },
  { feature: "Fournisseurs & bons de commande", starter: "—", pro: "✓", reseau: "✓", status: "available" },
  { feature: "Réappro guidé & quarantaine", starter: "—", pro: "✓", reseau: "✓", status: "beta" },
  { feature: "Multi-établissements", starter: "—", pro: "—", reseau: "✓", status: "beta" },
  { feature: "Statistiques consolidées réseau", starter: "—", pro: "—", reseau: "✓", status: "beta" },
  { feature: "Paiement en ligne intégré", starter: "—", pro: "—", reseau: "—", status: "coming" },
  { feature: "Messagerie client intégrée", starter: "—", pro: "—", reseau: "—", status: "coming" },
];