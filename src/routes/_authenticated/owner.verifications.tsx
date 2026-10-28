import { createFileRoute } from "@tanstack/react-router";
import { VerificationsTab } from "@/components/owner/panels";
export const Route = createFileRoute("/_authenticated/owner/verifications")({
  head: () => ({ meta: [{ title: "Vérifications · Console patron" }] }),
  component: VerificationsTab,
});