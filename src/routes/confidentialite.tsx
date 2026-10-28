import { createFileRoute } from "@tanstack/react-router";
import { PublishedLegalDocument } from "@/components/public/PublishedLegalDocument";
import { getPublishedLegalDocumentFn } from "@/lib/legal-public.functions";

export const Route = createFileRoute("/confidentialite")({
  loader: () => getPublishedLegalDocumentFn({ data: { code: "privacy_policy" } }),
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — BPEI" },
      { name: "description", content: "Politique de confidentialité BPEI publiée : données collectées, finalités, durées, droits." },
      { property: "og:title", content: "Politique de confidentialité — BPEI" },
      { property: "og:url", content: "https://bpei.fr/confidentialite" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/confidentialite" }],
  }),
  errorComponent: () => (
    <PublishedLegalDocument fallbackTitle="Politique de confidentialité" doc={null} />
  ),
  component: Page,
});

function Page() {
  const doc = Route.useLoaderData();
  return <PublishedLegalDocument fallbackTitle="Politique de confidentialité" doc={doc} />;
}