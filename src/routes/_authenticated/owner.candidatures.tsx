import { createFileRoute } from "@tanstack/react-router";
import { CandidaturesTab } from "@/components/owner/panels";
export const Route = createFileRoute("/_authenticated/owner/candidatures")({
  head: () => ({ meta: [{ title: "Candidatures · Console patron" }] }),
  component: CandidaturesTab,
});