import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias lisible (« bpei.fr/recrutement ») vers la page partenaires.
export const Route = createFileRoute("/recrutement")({
  beforeLoad: () => {
    throw redirect({ to: "/devenir-partenaire", statusCode: 301 });
  },
});