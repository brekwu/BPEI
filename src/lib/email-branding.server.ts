import { getPublishedPublicSettings, getPublishedLegalSettings } from "@/lib/platform-content.server";

/**
 * Bloc H2c — Résolveur central du branding e-mail.
 *
 * IMPORTANT : ce helper ne concerne QUE le rendu visuel (nom commercial,
 * logo, URL publique, liens support/contact/légal, footer). Il ne modifie
 * JAMAIS l'expéditeur technique (from, senderDomain, apiKey) : ces valeurs
 * restent contrôlées par la configuration serveur validée du webhook auth
 * et du helper d'envoi transactionnel.
 *
 * Toutes les valeurs proviennent uniquement des versions PUBLIÉES. Aucun
 * draft n'est jamais retourné, aucune constante marketing n'est inventée.
 */

export type PublishedEmailBranding = {
  commercialName: string;
  logoUrl: string | null;
  publicSiteUrl: string;
  supportEmail: string | null;
  contactEmail: string | null;
  complaintEmail: string | null;
  privacyUrl: string;
  contactUrl: string;
  legalNoticeUrl: string;
  footerText: string | null;
  copyrightText: string | null;
  primaryBrandLabel: string;
  socialLinks: Array<{ label: string; url: string }>;
};

// Repli technique minimal — jamais marketing, jamais juridique.
const TECHNICAL_FALLBACK_SITE_URL = "https://bpei.fr";
const TECHNICAL_FALLBACK_NAME = "BPEI";

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function urlOrNull(v: unknown): string | null {
  const s = stringOrNull(v);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : null;
}

export async function getPublishedEmailBranding(): Promise<PublishedEmailBranding> {
  const [settingsRow, legal] = await Promise.all([
    getPublishedPublicSettings(),
    getPublishedLegalSettings(),
  ]);
  const published = ((settingsRow?.published as Record<string, any> | undefined) ?? {}) as Record<string, any>;

  const identity = (published.identity ?? {}) as Record<string, any>;
  const contact = (published.contact ?? {}) as Record<string, any>;
  const seo = (published.seo ?? {}) as Record<string, any>;
  const socialRaw = (published.social ?? []) as unknown;

  const commercialName =
    stringOrNull(identity.commercial_name) ??
    stringOrNull(legal?.commercial_name) ??
    stringOrNull(legal?.legal_name) ??
    TECHNICAL_FALLBACK_NAME;

  const publicSiteUrl =
    urlOrNull(identity.public_site_url) ??
    urlOrNull(seo.canonical_base_url) ??
    TECHNICAL_FALLBACK_SITE_URL;

  const logoUrl = urlOrNull(identity.logo_url);

  const supportEmail = stringOrNull(contact.support_email) ?? stringOrNull(legal?.support_email);
  const contactEmail =
    stringOrNull(contact.email) ??
    stringOrNull(legal?.professional_email) ??
    supportEmail;
  const complaintEmail = stringOrNull(legal?.complaint_email);

  const socialLinks: Array<{ label: string; url: string }> = Array.isArray(socialRaw)
    ? (socialRaw as any[])
        .map((entry) => {
          const label = stringOrNull(entry?.label ?? entry?.platform);
          const url = urlOrNull(entry?.url);
          return label && url ? { label, url } : null;
        })
        .filter((v): v is { label: string; url: string } => v !== null)
    : [];

  return {
    commercialName,
    logoUrl,
    publicSiteUrl,
    supportEmail,
    contactEmail,
    complaintEmail,
    privacyUrl: `${publicSiteUrl.replace(/\/$/, "")}/confidentialite`,
    contactUrl: `${publicSiteUrl.replace(/\/$/, "")}/contact`,
    legalNoticeUrl: `${publicSiteUrl.replace(/\/$/, "")}/mentions-legales`,
    footerText: stringOrNull(published.copyright_text) ?? stringOrNull(seo.footer_text),
    copyrightText: stringOrNull(published.copyright_text),
    primaryBrandLabel: commercialName,
    socialLinks,
  };
}