// Schémas partagés (navigateur + serveur) pour le réseau national BPEI :
// candidatures de techniciens indépendants et demandes d'intervention clients.
import { z } from "zod";

export const SKILLS = [
  { value: "depannage_pc", label: "Dépannage PC / Mac" },
  { value: "smartphone_tablette", label: "Smartphones & tablettes" },
  { value: "reseau_wifi", label: "Réseau, box, Wi-Fi" },
  { value: "virus_securite", label: "Virus & sécurité" },
  { value: "installation_formation", label: "Installation & initiation" },
  { value: "recuperation_donnees", label: "Récupération de données" },
  { value: "microsoudure", label: "Réparation matérielle / micro-soudure" },
  { value: "imprimantes", label: "Imprimantes & périphériques" },
  { value: "informatique_entreprise", label: "Informatique d'entreprise (TPE/PME)" },
  { value: "domotique_tv", label: "TV, domotique, objets connectés" },
] as const;
export type SkillValue = (typeof SKILLS)[number]["value"];
const SKILL_VALUES = SKILLS.map((s) => s.value) as [SkillValue, ...SkillValue[]];

export const INTERVENTION_MODES = [
  { value: "domicile", label: "Au domicile des clients" },
  { value: "a_distance", label: "À distance" },
  { value: "entreprise", label: "En entreprise" },
  { value: "atelier", label: "Dans mon atelier / local" },
] as const;
const MODE_VALUES = INTERVENTION_MODES.map((m) => m.value) as [string, ...string[]];

export const EXPERIENCE_LEVELS = [
  { value: "moins_1", label: "Moins d'1 an" },
  { value: "1_3", label: "1 à 3 ans" },
  { value: "3_10", label: "3 à 10 ans" },
  { value: "plus_10", label: "Plus de 10 ans" },
] as const;

export const ACQUISITION_SOURCES = [
  { value: "reseaux_sociaux", label: "Réseaux sociaux" },
  { value: "bouche_a_oreille", label: "Bouche-à-oreille" },
  { value: "france_travail", label: "France Travail" },
  { value: "moteur_recherche", label: "Recherche Google / Internet" },
  { value: "partenaire", label: "Un partenaire BPEI" },
  { value: "presse", label: "Presse / article" },
  { value: "autre", label: "Autre" },
] as const;
const SOURCE_VALUES = ACQUISITION_SOURCES.map((s) => s.value) as [string, ...string[]];

export const DEVICE_TYPES = [
  { value: "ordinateur_portable", label: "Ordinateur portable" },
  { value: "ordinateur_fixe", label: "Ordinateur fixe" },
  { value: "mac", label: "Mac" },
  { value: "smartphone", label: "Smartphone" },
  { value: "tablette", label: "Tablette" },
  { value: "imprimante", label: "Imprimante" },
  { value: "reseau", label: "Box / réseau / Wi-Fi" },
  { value: "autre", label: "Autre" },
] as const;

export const PROBLEM_CATEGORIES = [
  { value: "panne", label: "Panne / ne démarre plus" },
  { value: "lenteur_virus", label: "Lenteur, virus, pop-ups" },
  { value: "installation", label: "Installation / configuration" },
  { value: "internet", label: "Internet / Wi-Fi" },
  { value: "donnees", label: "Données perdues / sauvegarde" },
  { value: "ecran_casse", label: "Écran ou pièce cassée" },
  { value: "aide_utilisation", label: "Aide à l'utilisation" },
  { value: "autre", label: "Autre" },
] as const;

const optText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

const postalCode = z.string().trim().regex(/^(\d{5}|\d{4}|2[AB]\d{3})$/i, "Code postal invalide (5 chiffres)");
const phone = z.string().trim().min(6, "Téléphone requis").max(30).regex(/^[+\d\s().-]+$/, "Téléphone invalide");

const tracking = {
  acquisition_source: z.enum(SOURCE_VALUES).optional().nullable(),
  acquisition_detail: optText(200),
  referral_code: z.string().trim().max(60).regex(/^[A-Za-z0-9_-]*$/, "Code parrain invalide").optional().nullable()
    .transform((v) => (v ? v.toUpperCase() : null)),
  utm_source: optText(100),
  utm_medium: optText(100),
  utm_campaign: optText(100),
};

export const TECHNICIAN_CONSENT_VERSION = "2026-10-29";

export const TechnicianApplicationSchema = z.object({
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().email("E-mail invalide").max(255),
  phone,
  city: z.string().trim().min(1, "Ville requise").max(120),
  postal_code: postalCode,
  business_status: z.enum(["immatricule", "en_projet"], { message: "Indiquez votre situation" }),
  siret: z.string().trim().replace(/\s/g, "").optional().nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{14}$/.test(v), "SIRET : 14 chiffres"),
  legal_form: optText(80),
  skills: z.array(z.enum(SKILL_VALUES)).min(1, "Choisissez au moins une compétence").max(SKILLS.length),
  skills_other: optText(500),
  experience_level: z.enum(["moins_1", "1_3", "3_10", "plus_10"]).optional().nullable(),
  intervention_modes: z.array(z.enum(MODE_VALUES)).max(INTERVENTION_MODES.length).default([]),
  service_radius_km: z.number().int().min(0).max(1000).optional().nullable(),
  covered_area: optText(500),
  availability: optText(300),
  has_insurance: z.boolean().optional().nullable(),
  message: optText(2000),
  ...tracking,
  consent: z.literal(true, { message: "Consentement requis" }),
});
export type TechnicianApplicationInput = z.input<typeof TechnicianApplicationSchema>;

export const InterventionRequestSchema = z.object({
  requester_type: z.enum(["particulier", "professionnel"]).default("particulier"),
  company_name: optText(160),
  first_name: z.string().trim().min(1, "Prénom requis").max(80),
  last_name: z.string().trim().min(1, "Nom requis").max(80),
  email: z.string().trim().email("E-mail invalide").max(255),
  phone,
  city: z.string().trim().min(1, "Ville requise").max(120),
  postal_code: postalCode,
  device_type: optText(60),
  problem_category: optText(60),
  description: z.string().trim().min(10, "Décrivez votre besoin (10 caractères minimum)").max(4000),
  preferred_mode: z.enum(["domicile", "a_distance", "indifferent"]).optional().nullable(),
  urgency: z.enum(["rapide", "cette_semaine", "flexible"]).optional().nullable(),
  availability: optText(300),
  ...tracking,
  consent: z.literal(true, { message: "Consentement requis" }),
});
export type InterventionRequestInput = z.input<typeof InterventionRequestSchema>;

/** Lit ?ref=, ?parrain=, ?utm_* depuis l'URL courante (navigateur uniquement). */
export function readTrackingParams(search: string): {
  referral_code: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null;
} {
  const p = new URLSearchParams(search);
  const clean = (v: string | null, max: number) => (v ? v.trim().slice(0, max) || null : null);
  const ref = clean(p.get("ref") ?? p.get("parrain"), 60);
  return {
    referral_code: ref && /^[A-Za-z0-9_-]+$/.test(ref) ? ref.toUpperCase() : null,
    utm_source: clean(p.get("utm_source"), 100),
    utm_medium: clean(p.get("utm_medium"), 100),
    utm_campaign: clean(p.get("utm_campaign"), 100),
  };
}

export function labelOf(list: ReadonlyArray<{ value: string; label: string }>, v: string | null | undefined) {
  if (!v) return "—";
  return list.find((x) => x.value === v)?.label ?? v;
}