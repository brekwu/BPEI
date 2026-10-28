import { createFileRoute, redirect } from "@tanstack/react-router";

// Ancien parcours boutique / ancien formulaire. Conservé comme redirection pour éviter les liens cassés.
export const Route = createFileRoute("/rejoindre")({
  beforeLoad: () => { throw redirect({ to: "/devenir-partenaire", replace: true }); },
  component: () => null,
});
