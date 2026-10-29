import { createFileRoute, redirect } from "@tanstack/react-router";

// Ancienne entrée boutique : le réseau BPEI est désormais exclusivement freelance.
export const Route = createFileRoute("/catalogue")({
  beforeLoad: () => { throw redirect({ to: "/devenir-partenaire", replace: true }); },
  component: () => null,
});
