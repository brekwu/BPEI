import { createFileRoute } from "@tanstack/react-router";
import { PartnershipsTab } from "@/components/owner/panels";
export const Route = createFileRoute("/_authenticated/owner/partenariats")({
  head: () => ({ meta: [{ title: "Partenariats · Console patron" }] }),
  component: PartnershipsTab,
});