// Central content configuration for the BPEI public site.
// Update pricing / contact info here — pages read from this file.

export const SITE = {
  name: "BPEI",
  fullName: "BPEI",
  tagline: "Le réseau de techniciens informatiques indépendants.",
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
    hostName: "Vercel",
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

// Ancien catalogue tarifaire des boutiques supprimé : BPEI fonctionne désormais avec des indépendants.
