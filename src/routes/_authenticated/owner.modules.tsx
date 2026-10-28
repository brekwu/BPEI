import { createFileRoute } from "@tanstack/react-router";
import { ModulesTab } from "@/components/owner/panels";
export const Route = createFileRoute("/_authenticated/owner/modules")({
  head: () => ({ meta: [{ title: "Modules · Console patron" }] }),
  component: ModulesTab,
});