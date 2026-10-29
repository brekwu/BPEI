import { createServerFn } from "@tanstack/react-start";
import {
  getPublishedPublicSettings,
  getPublishedLegalSettings,
} from "@/lib/platform-content.server";

/**
 * Bloc H2b — Wrappers publics SSR-safe pour exposer aux loaders les
 * paramètres actuellement publiés. Aucun draft n'est jamais retourné.
 */

export const getPublicSeoSnapshotFn = createServerFn({ method: "GET" }).handler(async () => {
  const row = await getPublishedPublicSettings();
  const published = ((row?.published ?? {}) as Record<string, any>);
  const identity = (published.identity ?? {}) as Record<string, any>;
  const seo = (published.seo ?? {}) as Record<string, any>;
  const pick = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const url = (v: unknown) => {
    const s = pick(v);
    return s && /^https?:\/\//i.test(s) ? s : null;
  };
  return {
    commercialName: pick(identity.commercial_name),
    seoTitle: pick(seo.default_seo_title) ?? pick(identity.default_seo_title),
    seoDescription: pick(seo.default_seo_description) ?? pick(identity.short_description),
    logoUrl: url(identity.logo_url),
    faviconUrl: url(identity.favicon_url),
    socialImage: url(seo.default_social_image) ?? url(identity.default_social_image),
    canonicalBaseUrl: url(seo.canonical_base_url) ?? url(identity.public_site_url),
  };
});



export const getPublicPlatformSettingsFn = createServerFn({ method: "GET" }).handler(async () => {
  const row = await getPublishedPublicSettings();
  const published = (row?.published ?? {}) as Record<string, any>;
  return {
    identity: published.identity ?? null,
    contact: published.contact ?? null,
    social: published.social ?? null,
    seo: published.seo ?? null,
    mediator: published.mediator ?? null,
    hosting: published.hosting ?? null,
    beta: published.beta ?? null,
  };
});

export const getPublicLegalIdentityFn = createServerFn({ method: "GET" }).handler(async () => {
  const row = await getPublishedLegalSettings();
  if (!row) return null;
  // Whitelist — jamais de valeurs marketing, jamais d'audit interne.
  return {
    legal_name: row.legal_name,
    commercial_name: row.commercial_name,
    legal_form: row.legal_form,
    capital_amount: row.capital_amount,
    registered_office_address: row.registered_office_address,
    registered_office_postal_code: row.registered_office_postal_code,
    registered_office_city: row.registered_office_city,
    registered_office_country: row.registered_office_country,
    siren: row.siren,
    siret: row.siret,
    rcs_city: row.rcs_city,
    rne_registration: row.rne_registration,
    vat_number: row.vat_number,
    professional_email: row.professional_email,
    professional_phone: row.professional_phone,
    publication_director_name: row.publication_director_name,
    legal_representative_name: row.legal_representative_name,
    hosting_provider_name: row.hosting_provider_name,
    hosting_provider_address: row.hosting_provider_address,
    hosting_provider_phone: row.hosting_provider_phone,
    hosting_provider_website: row.hosting_provider_website,
    privacy_contact_email: row.privacy_contact_email,
    complaint_email: row.complaint_email,
    complaint_postal_address: row.complaint_postal_address,
    support_email: row.support_email,
    mediator_name: row.mediator_name,
    mediator_address: row.mediator_address,
    mediator_website: row.mediator_website,
    governing_law: row.governing_law,
    competent_court_information: row.competent_court_information,
  };
});