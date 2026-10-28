import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MinusCircle, Clock, HelpCircle, Store, Home, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import {
  BETA_END_LABEL, FEATURES, PLANS, STATUS_LABEL, STATUS_CLASS,
  getPlanCellText,
  type PlanKey, type Profile, type Feature,
} from "@/lib/pricing-plans";

const searchSchema = z.object({
  profil: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/tarifs")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Tarifs BPEI — Boutiques et indépendants" },
      { name: "description", content: `Boutiques physiques et indépendants à domicile : choisissez l'offre adaptée à votre activité. Bêta gratuite jusqu'au ${BETA_END_LABEL}.` },
      { property: "og:title", content: "Tarifs BPEI — Boutiques et indépendants" },
      { property: "og:description", content: `Boutiques physiques et indépendants à domicile. Bêta gratuite jusqu'au ${BETA_END_LABEL}. Aucune carte demandée.` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bpei.fr/tarifs" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/tarifs" }],
  }),
  component: TarifsPage,
});

function InclusionCell({ feature, planKey }: { feature: Feature; planKey: PlanKey }) {
  const { status, label, detail } = getPlanCellText(feature, planKey);
  const Icon = status === "included" ? CheckCircle2 : status === "not_included" ? MinusCircle : Clock;
  const color =
    status === "included" ? "text-emerald-600" :
    status === "not_included" ? "text-muted-foreground/40" :
    status === "limited" ? "text-amber-600" : "text-sky-600";
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
      <span className={`text-xs font-medium ${status === "not_included" ? "text-muted-foreground/60" : ""}`}>{label}</span>
      {detail && (
        <span className="mt-0.5 max-w-[16rem] text-[11px] leading-snug text-muted-foreground">
          {detail}
        </span>
      )}
    </div>
  );
}

function TarifsPage() {
  const { profil } = Route.useSearch();
  const activeProfile: Profile | null =
    profil === "boutique" ? "boutique" : profil === "independant" ? "independant" : null;

  return (
    <PublicShell>
      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto max-w-6xl px-4 py-3 text-center text-sm text-amber-900 md:px-6">
          <strong>Bêta :</strong> les offres sélectionnées bénéficient gratuitement de BPEI jusqu'au {BETA_END_LABEL}.
          Aucun prélèvement automatique.
        </div>
      </div>

      <section className="border-b border-border py-16">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          <h1 className="text-3xl font-bold md:text-5xl">Choisissez l'offre adaptée à votre activité</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Les boutiques physiques et les indépendants à domicile n'ont pas les mêmes besoins.
            Sélectionnez votre profil pour découvrir les offres correspondantes.
          </p>
        </div>
      </section>

      {activeProfile === null ? (
        <ProfileChoice />
      ) : (
        <>
          <ProfileSwitcher active={activeProfile} />
          <PlansGrid profile={activeProfile} />
          <Comparator profile={activeProfile} />
          {activeProfile === "boutique" ? <ShopNetworkSection /> : <IndependentNetworkSection />}
        </>
      )}

      <NetworkTeaserSection />

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-6">
          <h2 className="text-2xl font-bold md:text-3xl">Prêt à rejoindre le réseau BPEI ?</h2>
          <p className="mt-3 text-muted-foreground">
            Envoyez votre candidature. Notre équipe étudie chaque dossier et vous recontacte sous quelques jours ouvrés.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-electric text-electric-foreground hover:bg-electric/90">
              <Link to="/rejoindre">Envoyer ma candidature</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/contact">Nous contacter</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function ProfileChoice() {
  return (
    <section className="py-12">
      <div className="mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-2 md:px-6">
        <Card className="transition hover:shadow-lg">
          <CardContent className="flex h-full flex-col items-start gap-4 pt-6">
            <div className="rounded-full bg-electric/10 p-3 text-electric"><Store className="h-6 w-6" /></div>
            <h2 className="text-xl font-bold">Je possède une boutique physique</h2>
            <p className="text-sm text-muted-foreground">
              Gérez votre magasin, vos clients, vos réparations, votre stock, votre équipe,
              vos ventes et votre visibilité depuis un seul espace.
            </p>
            <Button asChild className="mt-auto w-full bg-electric text-electric-foreground hover:bg-electric/90">
              <Link to="/tarifs" search={{ profil: "boutique" }}>Voir les offres boutiques</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="transition hover:shadow-lg">
          <CardContent className="flex h-full flex-col items-start gap-4 pt-6">
            <div className="rounded-full bg-electric/10 p-3 text-electric"><Home className="h-6 w-6" /></div>
            <h2 className="text-xl font-bold">Je suis indépendant à domicile</h2>
            <p className="text-sm text-muted-foreground">
              Gérez vos déplacements, vos interventions, vos clients, vos devis et développez
              des partenariats avec les boutiques du réseau.
            </p>
            <Button asChild className="mt-auto w-full bg-electric text-electric-foreground hover:bg-electric/90">
              <Link to="/tarifs" search={{ profil: "independant" }}>Voir les offres indépendants</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function ProfileSwitcher({ active }: { active: Profile }) {
  return (
    <div className="border-b border-border bg-secondary/30 py-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 md:px-6">
        <Link to="/tarifs" search={{ profil: "" }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Choix du profil
        </Link>
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          <Link to="/tarifs" search={{ profil: "boutique" }}
            className={`rounded-md px-4 py-2 font-medium ${active === "boutique" ? "bg-electric text-electric-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Boutiques physiques
          </Link>
          <Link to="/tarifs" search={{ profil: "independant" }}
            className={`rounded-md px-4 py-2 font-medium ${active === "independant" ? "bg-electric text-electric-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            Indépendants à domicile
          </Link>
        </div>
      </div>
    </div>
  );
}

function PlansGrid({ profile }: { profile: Profile }) {
  const plans = PLANS.filter((p) => p.profile === profile);
  const gridCols = plans.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3";
  return (
    <section className="py-16">
      <div className={`mx-auto grid max-w-6xl gap-6 px-4 ${gridCols} md:px-6`}>
        {plans.map((p) => (
          <Card key={p.key} className={p.highlight ? "border-electric shadow-lg" : ""}>
            <CardContent className="flex h-full flex-col pt-6">
              {p.badge && <Badge className="mb-3 w-fit bg-electric text-electric-foreground">{p.badge}</Badge>}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.tagline}</p>
              <div className="mt-6">
                <div className="text-2xl font-bold">{p.priceLabel}</div>
                {p.priceSubLabel && <div className="mt-1 text-xs text-muted-foreground">{p.priceSubLabel}</div>}
                {p.betaLabel && (
                  <div className="mt-3 rounded-md bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-900">
                    {p.betaLabel}
                  </div>
                )}
              </div>
              <ul className="mt-6 flex-1 space-y-1.5 border-t border-border pt-4 text-sm">
                {FEATURES.filter((f) => f.profile === profile && f.plans[p.key] === "included").slice(0, 10).map((f) => (
                  <li key={f.key} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{f.name}</span>
                  </li>
                ))}
              </ul>
              {p.disclaimer && (
                <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  {p.disclaimer}
                </p>
              )}
              <Button
                asChild
                className={`mt-6 w-full ${p.highlight ? "bg-electric text-electric-foreground hover:bg-electric/90" : ""}`}
                variant={p.highlight ? "default" : "outline"}
              >
                <Link to={p.ctaHref}>{p.ctaLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-3xl px-4 text-center text-xs text-muted-foreground md:px-6">
        Aucun paiement en ligne pendant la bêta. L'activation payante après le {BETA_END_LABEL} se fera après contact avec notre équipe.
      </p>
    </section>
  );
}

function Comparator({ profile }: { profile: Profile }) {
  const plans = PLANS.filter((p) => p.profile === profile);
  const features = FEATURES.filter((f) => f.profile === profile);
  return (
    <section className="border-t border-border bg-secondary/30 py-16">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="text-2xl font-bold md:text-3xl">
          Comparaison des offres {profile === "boutique" ? "boutiques" : "indépendants"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Chaque ligne indique ce qui est inclus dans la formule, avec un statut précisant si la fonction est disponible aujourd'hui, en bêta, prochainement ou sur demande.
        </p>

        <div className="mt-6 hidden overflow-hidden rounded-lg border border-border bg-card md:block">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Fonctionnalité</th>
                {plans.map((p) => <th key={p.key} className="p-3">{p.name.replace("BPEI ", "")}</th>)}
                <th className="p-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.key} className="border-t border-border align-top">
                  <td className="p-3">
                    <div className="font-medium">{f.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{f.summary}</div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-electric hover:underline"><HelpCircle className="inline h-3 w-3" /> En savoir plus</summary>
                      <p className="mt-1 text-xs text-muted-foreground">{f.details}</p>
                    </details>
                  </td>
                  {plans.map((p) => (
                    <td key={p.key} className="p-3"><InclusionCell feature={f} planKey={p.key} /></td>
                  ))}
                  <td className="p-3 text-center"><Badge className={STATUS_CLASS[f.status]}>{STATUS_LABEL[f.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-6 space-y-3 md:hidden">
          {features.map((f) => (
            <li key={f.key} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.summary}</div>
                </div>
                <Badge className={STATUS_CLASS[f.status]}>{STATUS_LABEL[f.status]}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{f.details}</p>
              <div className={`mt-3 grid gap-2 text-center text-xs ${plans.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                {plans.map((p) => (
                  <div key={p.key}>
                    <div className="text-muted-foreground">{p.name.replace("BPEI ", "")}</div>
                    <InclusionCell feature={f} planKey={p.key as PlanKey} />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-muted-foreground">
          Les fonctionnalités « Bêta » peuvent encore évoluer. Les fonctionnalités « Prochainement » ne sont pas considérées comme incluses tant qu'elles ne sont pas activées.
        </p>
      </div>
    </section>
  );
}

function ShopNetworkSection() {
  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <h2 className="text-2xl font-bold md:text-3xl">Développez vos services sans recruter immédiatement</h2>
        <p className="mt-3 text-muted-foreground">
          Les boutiques Pro et Réseau peuvent publier des opportunités et travailler avec des indépendants BPEI vérifiés :
        </p>
        <ul className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          {[
            "Proposer des interventions à domicile",
            "Répondre aux demandes éloignées",
            "Installer du matériel chez les clients",
            "Proposer des contrats de maintenance",
            "Absorber les périodes de forte activité",
            "Collaborer avec des professionnels vérifiés",
          ].map((s) => (
            <li key={s} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{s}</span></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function IndependentNetworkSection() {
  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <h2 className="text-2xl font-bold md:text-3xl">Accédez à de nouvelles opportunités professionnelles</h2>
        <p className="mt-3 text-muted-foreground">
          Les indépendants Partenaire Premium peuvent postuler à des missions proposées par les boutiques du réseau :
        </p>
        <ul className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          {[
            "Missions proposées par les boutiques",
            "Contrats récurrents",
            "Interventions à domicile",
            "Installations",
            "Maintenance",
            "Meilleure visibilité locale",
            "Partenariats locaux",
            "Zones prioritaires ou exclusives selon accord",
          ].map((s) => (
            <li key={s} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{s}</span></li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          L'accès aux opportunités ne garantit ni missions, ni chiffre d'affaires, ni exclusivité automatique.
          Chaque partenariat est volontaire et encadré par des conditions acceptées par les deux parties.
        </p>
      </div>
    </section>
  );
}

function NetworkTeaserSection() {
  return (
    <section className="border-t border-border bg-secondary/30 py-16">
      <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
        <h2 className="text-2xl font-bold md:text-3xl">Indépendants et boutiques, plus forts ensemble</h2>
        <p className="mx-auto mt-4 max-w-3xl text-muted-foreground">
          Les boutiques BPEI peuvent développer leur offre de services grâce à des professionnels indépendants vérifiés.
          Les indépendants Premium peuvent accéder à des opportunités de sous-traitance, de maintenance, d'installation
          et d'intervention à domicile. Chaque partenariat reste volontaire et encadré par des conditions acceptées par
          les deux parties.
        </p>
      </div>
    </section>
  );
}