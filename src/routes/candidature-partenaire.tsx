import { createFileRoute, redirect } from "@tanstack/react-router";

// Ancien parcours boutique / ancien formulaire. Conservé comme redirection pour éviter les liens cassés.
export const Route = createFileRoute("/candidature-partenaire")({
  beforeLoad: () => { throw redirect({ to: "/espace-independant", replace: true }); },
  component: () => null,
});
