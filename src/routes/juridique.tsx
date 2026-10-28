import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";

export const Route = createFileRoute("/juridique")({
  head: () => ({
    meta: [
      { title: "Informations juridiques — BPEI" },
      { name: "description", content: "Informations légales et protection des données du réseau de techniciens informatiques indépendants BPEI." },
    ],
  }),
  component: LegalHub,
});

const LINKS = [
  { to: "/mentions-legales" as const, label: "Mentions légales" },
  { to: "/confidentialite" as const, label: "Protection des données personnelles" },
  { to: "/cgu" as const, label: "Conditions d'utilisation" },
  { to: "/cookies" as const, label: "Politique relative aux cookies" },
  { to: "/demande-donnees" as const, label: "Exercer mes droits RGPD" },
  { to: "/contact" as const, label: "Contact" },
];

function LegalHub() {
  return <PublicShell>
    <section className="mx-auto max-w-4xl px-4 py-14 md:px-6">
      <h1 className="text-3xl font-bold">Informations juridiques de BPEI</h1>
      <p className="mt-4 text-muted-foreground">
        BPEI développe un réseau de techniciens informatiques indépendants. Les documents non validés ne sont pas considérés comme publiés.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {LINKS.map(item => <li key={item.to} className="rounded-lg border bg-card p-4"><Link to={item.to} className="font-semibold underline underline-offset-4">{item.label}</Link></li>)}
      </ul>
    </section>
  </PublicShell>;
}
