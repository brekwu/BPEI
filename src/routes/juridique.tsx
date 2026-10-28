import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";

export const Route = createFileRoute("/juridique")({
  head: () => ({
    meta: [
      { title: "Centre juridique — BPEI" },
      { name: "description", content: "Toutes les informations juridiques, contractuelles et de conformité de la plateforme BPEI." },
      { property: "og:title", content: "Centre juridique — BPEI" },
      { property: "og:description", content: "Politiques, conditions, signalements et droits utilisateurs." },
      { property: "og:url", content: "https://bpei.fr/juridique" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/juridique" }],
  }),
  component: LegalHub,
});

const groups: Array<{ title: string; items: Array<{ to: string; label: string; desc: string }> }> = [
  {
    title: "Identité & informations légales",
    items: [
      { to: "/mentions-legales", label: "Mentions légales", desc: "Éditeur, hébergeur, directeur de publication." },
      { to: "/confidentialite", label: "Politique de confidentialité", desc: "Données collectées, base légale, droits RGPD." },
      { to: "/cookies", label: "Politique cookies", desc: "Catégories, durées, gestion du consentement." },
    ],
  },
  {
    title: "Utilisation & abonnements",
    items: [
      { to: "/cgu", label: "Conditions d'utilisation", desc: "Règles d'accès et d'usage du site." },
      { to: "/cgv", label: "CGV / CGS", desc: "Conditions générales de vente et de service." },
      { to: "/conditions-beta", label: "Conditions de la bêta", desc: "Cadre spécifique à la phase bêta gratuite." },
      { to: "/conditions-abonnement", label: "Conditions des abonnements", desc: "Durée, résiliation, période d'engagement." },
    ],
  },
  {
    title: "Vendeurs & annuaire",
    items: [
      { to: "/annuaire/regles-admission", label: "Règles d'admission à l'annuaire", desc: "Critères pour figurer parmi les boutiques BPEI." },
      { to: "/annuaire/badge-verifie", label: "Badge Vérifié BPEI", desc: "Ce que garantit et ne garantit pas le badge." },
      { to: "/annuaire/classement", label: "Méthode de classement", desc: "Paramètres principaux du tri des boutiques." },
      { to: "/vendeurs/regles", label: "Règles applicables aux vendeurs", desc: "Obligations d'information et de comportement." },
    ],
  },
  {
    title: "Commandes, paiements & avis",
    items: [
      { to: "/commandes/role-bpei", label: "Rôle de BPEI dans les commandes", desc: "Qui est vendeur, qui est intermédiaire." },
      { to: "/pay/politique", label: "Conditions des liens de paiement", desc: "Encaissement direct par la boutique." },
      { to: "/avis/politique", label: "Politique des avis", desc: "Vérification, publication et signalement." },
    ],
  },
  {
    title: "Modération, signalements & recours",
    items: [
      { to: "/moderation", label: "Règles de modération", desc: "Contenus retirés, mesures possibles." },
      { to: "/signalement", label: "Signaler un contenu ou une boutique", desc: "Formulaire conforme au règlement européen (DSA)." },
      { to: "/suspension-recours", label: "Suspension et recours", desc: "Procédure d'appel pour les vendeurs." },
      { to: "/reclamations", label: "Réclamations & médiation", desc: "Consommateurs et service client." },
    ],
  },
  {
    title: "Données personnelles",
    items: [
      { to: "/demande-donnees", label: "Exercer mes droits (RGPD)", desc: "Accès, rectification, effacement, opposition." },
    ],
  },
];

function LegalHub() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Centre juridique BPEI</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Retrouvez ici l'ensemble des documents contractuels, politiques et outils
          juridiques applicables au site BPEI. Les versions publiées font foi.
        </p>
        <div className="mt-10 space-y-10">
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="text-lg font-semibold">{g.title}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {g.items.map((it) => (
                  <Link
                    key={it.to}
                    to={it.to}
                    className="rounded-xl border border-border bg-card p-4 transition hover:border-electric hover:bg-secondary/40"
                  >
                    <div className="font-medium">{it.label}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{it.desc}</div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}