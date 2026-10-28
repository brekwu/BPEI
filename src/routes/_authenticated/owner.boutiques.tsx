import { createFileRoute } from "@tanstack/react-router";
import { ShopsTab } from "@/components/owner/panels";
export const Route = createFileRoute("/_authenticated/owner/boutiques")({
  head: () => ({ meta: [{ title: "Boutiques · Console patron" }] }),
  component: ShopsTab,
});