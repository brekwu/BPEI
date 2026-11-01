import { createFileRoute, Link } from "@tanstack/react-router";
import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {canRegisterIndependent} from "@/lib/bpei-launch-policy";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, BadgeCheck, Briefcase, CheckCircle2, Compass, XCircle } from "lucide-react";
import { FAQ_PARTNERS, HOW_IT_WORKS_PARTNER } from "@/lib/network-content";

const TITLE = "Devenir partenaire indépendant — Recrutement BPEI";
const DESCRIPTION =
  "Techniciens informatiques indépendants, déjà immatriculés ou en projet : rejoignez le réseau national BPEI. Collaboration freelance non salariée, candidature gratuite.";

export const Route = createFileRoute("/devenir-partenaire")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Techniciens informatiques indépendants : rejoignez BPEI" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bpei.fr/devenir-partenaire" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/devenir-partenaire" }],
  }),
  component: PartnerPage,
});

type RecruitmentAvailability="checking"|"open"|"closed";
function PartnerPage() {
  const [recruitment,setRecruitment]=useState<RecruitmentAvailability>("checking");
  useEffect(()=>{
    let alive=true;
    const db=supabase as any;
    db.from("bpei_launch_controls")
      .select("legal_documents_published,independent_registration_enabled,legal_version")
      .eq("id",true).maybeSingle()
      .then(({data,error}:{data:unknown;error:unknown})=>{
        if(alive)setRecruitment(!error&&canRegisterIndependent(data as any)?"open":"closed");
      })
      .catch(()=>{if(alive)setRecruitment("closed");});
    return ()=>{alive=false;};
  },[]);
  const open=recruitment==="open";
  const recruitmentMessage=recruitment==="checking"
    ?"Vérification de l'ouverture des candidatures…"
    :"Les nouvelles candidatures ne sont pas encore ouvertes. L'espace reste accessible aux comptes existants.";
  return (
    <PublicShell>
      <section className="bpei-hero-bg text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80">
              <Briefcase className="h-3 w-3" /> {open?"Recrutement de partenaires freelance":"Réseau d'indépendants en préparation"}
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-5xl">
              Technicien informatique indépendant ? Rejoignez le réseau BPEI
            </h1>
            <p className="mt-6 text-lg text-white/75">
              BPEI construit un réseau national de techniciens indépendants pour répondre aux demandes
              de particuliers et de petites entreprises. Vous restez indépendant(e), libre de vos choix.
            </p>
            {!open&&<p className="mt-5 max-w-xl text-sm text-white/85" role="status">{recruitmentMessage}</p>}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-electric text-electric-foreground hover:bg-electric/90">
                <Link to="/espace-independant">{open?"Déposer ma candidature":"Accéder à l'espace indépendant"} <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <a href="#faq">Questions fréquentes</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Cadre clair */}
      <section className="border-b border-border py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="text-2xl font-bold md:text-3xl">Un cadre clair, dès le départ</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-electric" />Ce que BPEI propose</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  "Une collaboration entre professionnels indépendants (freelance)",
                  "Des demandes de clients de votre zone, lorsqu'il y en a",
                  "La liberté d'accepter ou de refuser chaque demande",
                  "La liberté de travailler avec vos propres clients et d'autres plateformes",
                  "Des conditions écrites, présentées avant toute première mission",
                ].map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-electric" />{x}</li>)}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 font-semibold"><XCircle className="h-5 w-5 text-destructive" />Ce que BPEI n'est pas</h3>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  "Ce n'est pas une offre d'emploi salarié",
                  "Il n'y a pas de rémunération fixe ni de revenu garanti",
                  "Aucun volume de missions n'est promis",
                  "Aucun frais n'est demandé pour candidater",
                  "Une candidature n'ouvre aucun accès automatique aux missions",
                ].map((x) => <li key={x} className="flex gap-2"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{x}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Deux profils */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="text-2xl font-bold md:text-3xl">Qui peut candidater ?</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <BadgeCheck className="h-6 w-6 text-electric" />
              <h3 className="mt-3 text-lg font-semibold">Vous êtes déjà immatriculé(e)</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Micro-entreprise, entreprise individuelle ou société avec une activité de services informatiques.
                Votre SIRET et votre assurance RC Pro seront vérifiés avant toute mission.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <Compass className="h-6 w-6 text-electric" />
              <h3 className="mt-3 text-lg font-semibold">Vous avez un projet de création</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Vous avez les compétences et souhaitez vous lancer à votre compte ? Préparez votre dossier pour l'ouverture du recrutement.
                L'immatriculation restera obligatoire avant toute mission. France Travail, l'URSSAF ou votre CCI/CMA
                peuvent vous accompagner dans la création.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Étapes */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="text-2xl font-bold md:text-3xl">Les étapes</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-4">
            {HOW_IT_WORKS_PARTNER.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-card p-6">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-bold text-navy-foreground">{i + 1}</div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-secondary/30 py-16">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <h2 className="text-2xl font-bold md:text-3xl">Questions fréquentes</h2>
          <Accordion type="single" collapsible className="mt-6">
            {FAQ_PARTNERS.map((f, i) => (
              <AccordionItem key={f.q} value={`p${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-10 rounded-xl border border-border bg-card p-6 text-center">
            <h3 className="text-lg font-semibold">{open?"Prêt(e) à rejoindre le réseau ?":"Le réseau BPEI est en préparation"}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{open
              ?"Candidature gratuite, sans engagement. Réponse de l'équipe BPEI après examen."
              :recruitmentMessage}</p>
            <Button asChild size="lg" className="mt-5 bg-electric text-electric-foreground hover:bg-electric/90">
              <Link to="/espace-independant">{open?"Déposer ma candidature":"Accéder à l'espace indépendant"} <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">
              Une question avant de candidater ? <Link to="/contact" search={{ subject: "rejoindre" }} className="underline">Contactez-nous</Link>.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}