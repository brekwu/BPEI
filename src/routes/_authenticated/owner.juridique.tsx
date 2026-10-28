import { createFileRoute } from "@tanstack/react-router";
import { LegalTab } from "@/components/owner/panels";
export const Route = createFileRoute("/_authenticated/owner/juridique")({
  head: () => ({ meta: [{ title: "Juridique · Console patron" }] }),
  component: LegalTab,
});