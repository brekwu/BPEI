import { createFileRoute } from "@tanstack/react-router";
import { PublicationsTab } from "@/components/owner/panels";
export const Route = createFileRoute("/_authenticated/owner/publications")({
  head: () => ({ meta: [{ title: "Publications · Console patron" }] }),
  component: PublicationsTab,
});