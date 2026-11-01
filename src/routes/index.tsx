import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { BPEILogo } from "@/components/BPEILogo";
import { Button } from "@/components/ui/button";
import { ArrowRight, BadgeCheck, Handshake, HeartHandshake, Laptop, MapPin, Scale } from "lucide-react";
import { HOW_IT_WORKS_CLIENT } from "@/lib/network-content";

const TITLE = "BPEI — Bureau des Partenaires et Entrepreneurs de l’Informatique";
const DESCRIPTION =
  "Besoin d'un dépannage informatique ? Décrivez votre besoin : BPEI cherche un technicien indépendant vérifié près de chez vous. Techniciens freelance : rejoignez le réseau.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bpei.fr/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/" }],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* HERO */}
        <section className="relative overflow-hidden bpei-hero-bg text-navy-foreground">
          <div className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
            <div className="grid items-center gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80 backdrop-blur">
                  <MapPin className="h-3 w-3" /> Réseau national en constitution
                </div>
                <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-white md:text-6xl">
                  BPEI, le réseau national des techniciens informatiques indépendants
                </h1>
                <p className="mt-6 max-w-2xl text-lg text-white/75 md:text-xl">
                  Une panne, un ordinateur lent, un Wi-Fi capricieux ? Décrivez votre besoin :
                  BPEI — Bureau des Partenaires et Entrepreneurs de l’Informatique — recherche un partenaire vérifié dans les zones réellement couvertes.
                </p>
                <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button asChild size="lg" className="bg-electric text-electric-foreground hover:bg-electric/90">
                    <Link to="/demander-une-intervention">
                      Demander une intervention <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link to="/trouver-un-technicien">Rechercher un partenaire BPEI</Link></Button>
                  <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                    <Link to="/devenir-partenaire">Devenir partenaire indépendant</Link>
                  </Button>
                </div>
                <p className="mt-5 max-w-xl text-sm text-white/60">
                  Demande gratuite et sans engagement. Le réseau se construit région par région :
                  nous vous indiquons honnêtement si un partenaire peut intervenir dans votre zone.
                </p>
              </div>
              <div className="hidden justify-center lg:flex lg:justify-end">
                <BPEILogo variant="light" size={220} className="rounded-2xl p-6 shadow-2xl" />
              </div>
            </div>
          </div>
        </section>

        {/* DEUX PUBLICS */}
        <section className="border-b border-border/60 py-20">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 md:grid-cols-2 md:px-6">
            <AudienceCard
              icon={<Laptop className="h-5 w-5" />}
              kicker="Particuliers & petites entreprises"
              title="Un technicien informatique près de chez vous"
              points={[
                "Dépannage PC, Mac, smartphone, imprimante",
                "Internet, box, Wi-Fi, sécurité, virus",
                "Installation, sauvegarde, récupération de données",
                "À domicile ou à distance, selon les partenaires",
              ]}
              cta={{ to: "/demander-une-intervention", label: "Demander une intervention" }}
            />
            <AudienceCard
              icon={<Handshake className="h-5 w-5" />}
              kicker="Techniciens indépendants"
              title="Rejoignez un réseau sérieux, en restant indépendant"
              points={[
                "Collaboration freelance, non salariée",
                "Déjà immatriculé(e) ou en projet de création",
                "Libre d'accepter ou de refuser chaque demande",
                "Candidature gratuite, vérification avant toute mission",
              ]}
              cta={{ to: "/devenir-partenaire", label: "Devenir partenaire indépendant" }}
              secondary
            />
          </div>
        </section>

        {/* COMMENT ÇA MARCHE */}
        <section className="bg-secondary/40 py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Comment ça marche</h2>
                <p className="mt-3 text-lg text-muted-foreground">Simple, transparent, sans engagement.</p>
              </div>
              <Button asChild variant="outline"><Link to="/comment-ca-marche">Tout comprendre & FAQ</Link></Button>
            </div>
            <ol className="mt-10 grid gap-4 md:grid-cols-4">
              {HOW_IT_WORKS_CLIENT.map((s, i) => (
                <li key={s.title} className="rounded-xl border border-border bg-card p-6">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-bold text-navy-foreground">{i + 1}</div>
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ENGAGEMENTS */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <h2 className="max-w-2xl text-3xl font-bold tracking-tight md:text-4xl">Nos engagements</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                { icon: BadgeCheck, title: "Partenaires vérifiés", desc: "Identité, immatriculation et assurance sont vérifiées avant qu'un partenaire puisse recevoir des demandes." },
                { icon: Scale, title: "Transparence", desc: "Pas de couverture fictive : si aucun partenaire n'est disponible dans votre zone, nous vous le disons." },
                { icon: HeartHandshake, title: "Indépendance respectée", desc: "Nos partenaires sont des professionnels indépendants. Aucune promesse irréaliste, ni aux clients ni aux techniciens." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-card p-6">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-navy/5 text-navy">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}

function AudienceCard({
  icon, kicker, title, points, cta, secondary,
}: {
  icon: React.ReactNode; kicker: string; title: string; points: string[];
  cta: { to: "/demander-une-intervention" | "/devenir-partenaire"; label: string }; secondary?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-electric">
        {icon} {kicker}
      </div>
      <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
      <ul className="mt-6 flex-1 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-sm">
            <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-electric" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Button asChild size="lg" className={secondary ? "bg-navy text-navy-foreground hover:bg-navy/90" : "bg-electric text-electric-foreground hover:bg-electric/90"}>
          <Link to={cta.to}>{cta.label} <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>
    </div>
  );
}