import { createFileRoute } from "@tanstack/react-router";
import { PublishedLegalDocument } from "@/components/public/PublishedLegalDocument";
import { PublicShell } from "@/components/public/PublicShell";
import { SafeMarkdown } from "@/components/public/SafeMarkdown";
import { getPublishedLegalDocumentFn } from "@/lib/legal-public.functions";
import { getPublicLegalIdentityFn } from "@/lib/platform-public.functions";

/**
 * Bloc H2b — /mentions-legales combine :
 *  - un bloc « Éditeur » structuré construit sur platform_legal_settings publiés,
 *  - puis le contenu contractuel versionné code=legal_notice (facultatif).
 * Aucune valeur factice, aucun fallback marketing.
 */
export const Route = createFileRoute("/mentions-legales")({
  loader: async () => {
    const [doc, identity] = await Promise.all([
      getPublishedLegalDocumentFn({ data: { code: "legal_notice" } }),
      getPublicLegalIdentityFn(),
    ]);
    return { doc, identity };
  },
  head: () => ({
    meta: [
      { title: "Mentions légales — BPEI" },
      { name: "description", content: "Mentions légales publiées : éditeur, hébergeur, contact, propriété intellectuelle." },
      { property: "og:title", content: "Mentions légales — BPEI" },
      { property: "og:url", content: "https://bpei.fr/mentions-legales" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/mentions-legales" }],
  }),
  errorComponent: () => (
    <PublishedLegalDocument fallbackTitle="Mentions légales" doc={null} />
  ),
  component: Page,
});

type LegalIdentity = Awaited<ReturnType<typeof getPublicLegalIdentityFn>>;

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || !value.trim()) return null;
  return (
    <div className="grid grid-cols-1 gap-1 py-2 text-sm md:grid-cols-[220px_1fr]">
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="text-muted-foreground">{value}</dd>
    </div>
  );
}

function LegalIdentityBlock({ identity }: { identity: LegalIdentity }) {
  if (!identity) return null;
  const officeParts = [
    identity.registered_office_address,
    [identity.registered_office_postal_code, identity.registered_office_city].filter(Boolean).join(" "),
    identity.registered_office_country,
  ].filter((s) => s && String(s).trim()).join(", ");
  const hasEditor = identity.legal_name || identity.siren || officeParts;
  const hasHost = identity.hosting_provider_name;
  if (!hasEditor && !hasHost) return null;
  return (
    <section className="mx-auto max-w-3xl px-4 md:px-6">
      {hasEditor && (
        <div className="mt-8 rounded-lg border border-border bg-card/40 p-4">
          <h2 className="text-lg font-semibold">Éditeur du site</h2>
          <dl className="mt-2 divide-y divide-border">
            <Row label="Dénomination sociale" value={identity.legal_name} />
            <Row label="Nom commercial" value={identity.commercial_name} />
            <Row label="Forme juridique" value={identity.legal_form} />
            <Row label="Capital social" value={identity.capital_amount} />
            <Row label="Siège social" value={officeParts || null} />
            <Row label="SIREN" value={identity.siren} />
            <Row label="SIRET" value={identity.siret} />
            <Row label="RCS" value={identity.rcs_city} />
            <Row label="Immatriculation RNE" value={identity.rne_registration} />
            <Row label="TVA intracommunautaire" value={identity.vat_number} />
            <Row label="Représentant légal" value={identity.legal_representative_name} />
            <Row label="Directeur de la publication" value={identity.publication_director_name} />
            <Row label="Contact professionnel" value={identity.professional_email} />
            <Row label="Téléphone" value={identity.professional_phone} />
          </dl>
        </div>
      )}
      {hasHost && (
        <div className="mt-4 rounded-lg border border-border bg-card/40 p-4">
          <h2 className="text-lg font-semibold">Hébergeur</h2>
          <dl className="mt-2 divide-y divide-border">
            <Row label="Nom" value={identity.hosting_provider_name} />
            <Row label="Adresse" value={identity.hosting_provider_address} />
            <Row label="Téléphone" value={identity.hosting_provider_phone} />
            <Row label="Site" value={identity.hosting_provider_website} />
          </dl>
        </div>
      )}
    </section>
  );
}

function Page() {
  const { doc, identity } = Route.useLoaderData();
  const hasIdentity = !!identity && (identity.legal_name || identity.siren || identity.hosting_provider_name);
  if (!doc && !hasIdentity) {
    return <PublishedLegalDocument fallbackTitle="Mentions légales" doc={null} />;
  }
  return (
    <PublicShell>
      <div className="pb-12">
        {doc ? (
          // PublishedLegalDocument gère son propre PublicShell — on l'inline sans double-wrap :
          <PublishedLegalDocumentInline doc={doc} fallbackTitle="Mentions légales" />
        ) : (
          <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Mentions légales</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Le texte contractuel des mentions légales n'est pas encore publié. Les informations structurées de l'éditeur figurent ci-dessous.
            </p>
          </div>
        )}
        <LegalIdentityBlock identity={identity} />
      </div>
    </PublicShell>
  );
}

// Rendu inline sans PublicShell (parent le fournit déjà).
function PublishedLegalDocumentInline({ doc, fallbackTitle }: { doc: NonNullable<Awaited<ReturnType<typeof getPublishedLegalDocumentFn>>>; fallbackTitle: string }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{doc.title ?? fallbackTitle}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Version {doc.version}
          {doc.effective_date && <> · Applicable à partir du {new Date(doc.effective_date).toLocaleDateString("fr-FR")}</>}
          {doc.published_at && <> · Publiée le {new Date(doc.published_at).toLocaleDateString("fr-FR")}</>}
          {doc.content_hash && <> · Empreinte : {doc.content_hash.slice(0, 12)}…</>}
        </p>
      </header>
      <SafeMarkdown>{doc.content}</SafeMarkdown>
    </article>
  );
}