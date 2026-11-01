import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight } from "lucide-react";
import { FAQ_CLIENTS, FAQ_PARTNERS, HOW_IT_WORKS_CLIENT, HOW_IT_WORKS_PARTNER } from "@/lib/network-content";

const TITLE = "Comment ça marche — BPEI, réseau de techniciens indépendants";
const DESCRIPTION =
  "Clients et techniciens indépendants : découvrez simplement comment fonctionne le réseau BPEI, étape par étape, et les réponses aux questions fréquentes.";

export const Route = createFileRoute("/comment-ca-marche")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bpei.fr/comment-ca-marche" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/comment-ca-marche" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [...FAQ_CLIENTS, ...FAQ_PARTNERS].map((f) => ({
          "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }),
    }],
  }),
  component: HowPage,
});

function HowPage() {
  return (
    <PublicShell>
      <section className="border-b border-border bg-secondary/30 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">Comment ça marche ?</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            BPEI met en relation des clients qui ont besoin d'aide en informatique avec des techniciens
            indépendants vérifiés. Le réseau est en cours de constitution, région par région.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 md:px-6">
          <Steps
            title="Vous avez besoin d'un technicien"
            steps={HOW_IT_WORKS_CLIENT}
            cta={<Button asChild className="bg-electric text-electric-foreground hover:bg-electric/90"><Link to="/demander-une-intervention">Demander une intervention <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
          />
          <Steps
            title="Vous êtes technicien indépendant"
            steps={HOW_IT_WORKS_PARTNER}
            cta={<Button asChild className="bg-navy text-navy-foreground hover:bg-navy/90"><Link to="/devenir-partenaire">Devenir partenaire <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>}
          />
        </div>
      </section>

      <section id="faq" className="border-t border-border bg-secondary/30 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-2 md:px-6">
          <FaqBlock title="FAQ clients" items={FAQ_CLIENTS} prefix="c" />
          <FaqBlock title="FAQ partenaires" items={FAQ_PARTNERS} prefix="p" />
        </div>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Une autre question ? <Link to="/contact" className="underline">Contactez l'équipe BPEI</Link>.
        </p>
      </section>
    </PublicShell>
  );
}

function Steps({ title, steps, cta }: { title: string; steps: Array<{ title: string; desc: string }>; cta: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <ol className="mt-6 space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-xl border border-border bg-card p-5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-navy-foreground">{i + 1}</span>
            <div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6">{cta}</div>
    </div>
  );
}

function FaqBlock({ title, items, prefix }: { title: string; items: Array<{ q: string; a: string }>; prefix: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <Accordion type="single" collapsible className="mt-4">
        {items.map((f, i) => (
          <AccordionItem key={f.q} value={`${prefix}${i}`}>
            <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}