import { createFileRoute } from "@tanstack/react-router";
import { PublishedLegalDocument } from "@/components/public/PublishedLegalDocument";
import { getPublishedLegalDocumentFn } from "@/lib/legal-public.functions";

export const Route = createFileRoute("/cookies")({
  loader: () => getPublishedLegalDocumentFn({ data: { code: "cookie_policy" } }),
  head: () => ({
    meta: [
      { title: "Cookies — BPEI" },
      { name: "description", content: "Politique cookies publiée : catégories, traceurs, préférences." },
      { property: "og:title", content: "Politique cookies — BPEI" },
      { property: "og:url", content: "https://bpei.fr/cookies" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/cookies" }],
  }),
  errorComponent: () => (
    <PublishedLegalDocument fallbackTitle="Cookies et traceurs" doc={null} />
  ),
  component: Page,
});

function Page() {
  const doc = Route.useLoaderData();
  return <PublishedLegalDocument fallbackTitle="Cookies et traceurs" doc={doc} />;
}