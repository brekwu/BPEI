import { createFileRoute } from "@tanstack/react-router";
import { TestsS5Tab } from "@/components/owner/panels";
export const Route = createFileRoute("/_authenticated/owner/tests")({
  head: () => ({ meta: [{ title: "Tests S5 · Console patron" }] }),
  component: TestsS5Tab,
});