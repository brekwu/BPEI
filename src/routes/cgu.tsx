import { createFileRoute } from "@tanstack/react-router";
import { PublishedLegalDocument } from "@/components/public/PublishedLegalDocument";
import { getPublishedLegalDocumentFn } from "@/lib/legal-public.functions";

export const Route = createFileRoute("/cgu")({
  loader: () => getPublishedLegalDocumentFn({ data: { code: "website_terms" } }),
  head: () => ({
    meta: [
      { title: "CGU — Conditions générales d'utilisation — BPEI" },
      { name: "description", content: "CGU publiées de la plateforme BPEI : accès, comptes, usages, responsabilités." },
      { property: "og:title", content: "Conditions générales d'utilisation — BPEI" },
      { property: "og:url", content: "https://bpei.fr/cgu" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/cgu" }],
  }),
  errorComponent: () => (
    <PublishedLegalDocument fallbackTitle="Conditions générales d'utilisation (CGU)" doc={null} />
  ),
  component: Page,
});

function Page() {
  const doc = Route.useLoaderData();
  return <PublishedLegalDocument fallbackTitle="Conditions générales d'utilisation (CGU)" doc={doc} />;
}