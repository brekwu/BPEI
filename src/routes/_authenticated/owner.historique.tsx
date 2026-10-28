import { createFileRoute } from "@tanstack/react-router";
import { HistoryTab } from "@/components/owner/panels";
export const Route = createFileRoute("/_authenticated/owner/historique")({
  head: () => ({ meta: [{ title: "Historique · Console patron" }] }),
  component: HistoryTab,
});