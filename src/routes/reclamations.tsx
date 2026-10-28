import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/public/PublicShell";
import { getPublicLegalIdentityFn, getPublicPlatformSettingsFn } from "@/lib/platform-public.functions";

export const Route = createFileRoute("/reclamations")({
  loader: async () => {
    const [settings, identity] = await Promise.all([
      getPublicPlatformSettingsFn(),
      getPublicLegalIdentityFn(),
    ]);
    const m = settings.mediator ?? {};
    return {
      mediator: {
        name: m.name ?? identity?.mediator_name ?? null,
        address: m.address ?? identity?.mediator_address ?? null,
        website: m.website ?? identity?.mediator_website ?? null,
        scope: m.scope ?? null,
      },
      complaint_email: identity?.complaint_email ?? null,
      complaint_postal_address: identity?.complaint_postal_address ?? null,
    };
  },
  head: () => ({
    meta: [
      { title: "Réclamations & médiation — BPEI" },
      { name: "description", content: "Procédure de réclamation BPEI, délais de traitement et information sur la médiation de la consommation." },
      { property: "og:title", content: "Réclamations et médiation — BPEI" },
      { property: "og:url", content: "https://bpei.fr/reclamations" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/reclamations" }],
  }),
  component: Page,
});

function Page() {
  const { mediator: m, complaint_email, complaint_postal_address } = Route.useLoaderData();
  return (
    <LegalPage
      title="Réclamations et médiation"
      intro="Cette page décrit la marche à suivre pour formuler une réclamation auprès de BPEI et, en cas d'échec de la résolution amiable, recourir à un médiateur de la consommation."
      sections={[
        { id: "prealable", title: "1. Contact préalable", body: (
          <>
            <p>
              Avant toute réclamation formelle, contactez BPEI via la page <a href="/contact" className="underline">Contact</a> en sélectionnant le sujet « Je souhaite faire une réclamation ». Une référence de dossier vous sera communiquée.
            </p>
            {(complaint_email || complaint_postal_address) && (
              <ul className="list-disc pl-5 space-y-1">
                {complaint_email && <li><b>E-mail réclamations :</b> <a className="underline" href={`mailto:${complaint_email}`}>{complaint_email}</a></li>}
                {complaint_postal_address && <li><b>Adresse postale :</b> {complaint_postal_address}</li>}
              </ul>
            )}
          </>
        )},
        { id: "delai", title: "2. Délai de traitement indicatif", body: <p>Les réclamations sont accusées réception sous 48 h ouvrées. Un premier retour circonstancié est apporté sous 15 jours ouvrés en fonction de la complexité du dossier.</p> },
        { id: "mediation", title: "3. Médiation de la consommation", body: (
          m.name ? (
            <>
              <p>Conformément aux articles L611-1 et suivants du Code de la consommation, tout consommateur a le droit de recourir gratuitement à un médiateur.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><b>Médiateur :</b> {m.name}</li>
                {m.address && <li><b>Adresse :</b> {m.address}</li>}
                {m.website && <li><b>Site :</b> <a className="underline" href={m.website} target="_blank" rel="noreferrer">{m.website}</a></li>}
                {m.scope && <li><b>Périmètre :</b> {m.scope}</li>}
              </ul>
            </>
          ) : (
            <p>Un médiateur de la consommation BPEI est en cours de désignation. Ses coordonnées seront publiées sur cette page dès qu'elles seront confirmées. En attendant, les litiges peuvent être portés devant la juridiction compétente.</p>
          )
        )},
        { id: "boutiques", title: "4. Réclamations concernant une boutique du réseau", body: <p>Pour tout litige portant sur une prestation ou une vente réalisée par une boutique du réseau, adressez-vous d'abord directement à la boutique concernée : le SAV, la garantie et la médiation restent de sa responsabilité. Ses coordonnées et son médiateur (le cas échéant) figurent sur sa fiche publique et ses documents.</p> },
        { id: "plateforme-ue", title: "5. Plateforme européenne de règlement des litiges", body: <p>La Commission européenne met à disposition une plateforme de règlement en ligne des litiges : <a className="underline" href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noreferrer">ec.europa.eu/consumers/odr</a>.</p> },
      ]}
    />
  );
}