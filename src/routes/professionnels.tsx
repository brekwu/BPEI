import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Children, cloneElement, isValidElement, useId, useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_CLASS, STATUS_LABEL, type AvailabilityStatus } from "@/lib/site-content";
import { submitDemoRequest } from "@/lib/site.functions";
import { ArrowRight, CheckCircle2, Building2, Users, Wrench, Package, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/professionnels")({
  head: () => ({
    meta: [
      { title: "Pour les professionnels — BPEI" },
      { name: "description", content: "Rejoignez BPEI : outils de gestion pour boutiques informatiques indépendantes (réparations, stock, factures) et visibilité en ligne." },
      { property: "og:title", content: "Rejoignez le réseau BPEI — Outils pour boutiques informatiques" },
      { property: "og:description", content: "Gérez clients, réparations, devis, stock et fournisseurs. Bénéficiez d'une visibilité en ligne et d'un réseau national." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bpei.fr/professionnels" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/professionnels" }],
  }),
  component: ProsPage,
});

const FEATURES: Array<{ group: string; items: Array<{ label: string; status: AvailabilityStatus }> }> = [
  { group: "Gestion quotidienne", items: [
    { label: "Clients", status: "available" }, { label: "Appareils", status: "available" },
    { label: "Réparations", status: "available" }, { label: "Rendez-vous", status: "available" },
    { label: "Historique", status: "available" }] },
  { group: "Gestion commerciale", items: [
    { label: "Devis", status: "available" }, { label: "Factures", status: "available" },
    { label: "Paiements manuels", status: "available" }, { label: "Avoirs", status: "available" },
    { label: "Documents PDF", status: "available" }] },
  { group: "Produits & achats", items: [
    { label: "Stock", status: "available" }, { label: "Mouvements", status: "available" },
    { label: "Fournisseurs", status: "available" }, { label: "Réapprovisionnement", status: "beta" },
    { label: "Bons de commande", status: "available" }, { label: "Quarantaine", status: "beta" }] },
  { group: "Relation client", items: [
    { label: "Portail client", status: "available" }, { label: "Suivi public", status: "available" },
    { label: "Avis", status: "available" }, { label: "Messagerie", status: "coming" }] },
  { group: "Visibilité", items: [
    { label: "Fiche boutique publique", status: "available" }, { label: "Services", status: "available" },
    { label: "Catalogue produits", status: "beta" }, { label: "Recherche de boutiques", status: "available" }] },
];

const demoSchema = z.object({
  first_name: z.string().trim().min(1, "Requis").max(80),
  last_name: z.string().trim().min(1, "Requis").max(80),
  shop_name: z.string().trim().min(1, "Requis").max(160),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail invalide").max(255),
  phone: z.string().trim().min(6, "Trop court").max(30),
  establishments_count: z.coerce.number().int().min(1).max(999).optional(),
  preferred_slot: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  consent: z.boolean().refine((v) => v === true, { message: "Consentement requis" }),
});
type DemoForm = z.infer<typeof demoSchema>;

function ProsPage() {
  const submit = useServerFn(submitDemoRequest);
  const [reference, setReference] = useState<string | null>(null);
  const form = useForm<DemoForm>({
    resolver: zodResolver(demoSchema),
    defaultValues: { consent: false as any },
  });

  async function onSubmit(values: DemoForm) {
    try {
      const res = await submit({ data: {
        first_name: values.first_name, last_name: values.last_name,
        shop_name: values.shop_name, city: values.city || null,
        email: values.email, phone: values.phone,
        establishments_count: values.establishments_count ?? null,
        preferred_slot: values.preferred_slot || null,
        message: values.message || null,
        consent: true,
      } });
      setReference(res.reference);
      form.reset({ consent: false as any });
      toast.success(`Demande enregistrée sous la référence ${res.reference}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  return (
    <PublicShell>
      {/* Hero */}
      <section className="bpei-hero-bg text-navy-foreground">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/80 backdrop-blur">
              <Building2 className="h-3 w-3" /> Pour les boutiques informatiques
            </div>
            <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-5xl">
              Gérez votre boutique plus simplement et rejoignez un réseau d'experts informatiques
            </h1>
            <p className="mt-6 text-lg text-white/75">
              BPEI est une plateforme de gestion et un réseau destinés aux boutiques informatiques indépendantes. Conservez votre entreprise, vos prix et votre identité — bénéficiez d'outils professionnels et d'une visibilité en ligne.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-electric text-electric-foreground hover:bg-electric/90">
                <a href="#demo">Demander une démonstration <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link to="/tarifs">Voir les tarifs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problèmes */}
      <section className="border-b border-border py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="text-2xl font-bold md:text-3xl">Les défis quotidiens d'une boutique informatique</h2>
          <p className="mt-3 text-muted-foreground">Voici ce que BPEI cherche à simplifier.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {["Suivi des réparations dispersé", "Devis et factures chronophages", "Stock difficile à suivre",
              "Communication client fragmentée", "Manque de visibilité en ligne", "Outils différents pour chaque tâche"].map((p) => (
              <li key={p} className="rounded-lg border border-border bg-card p-4 text-sm">{p}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Fonctions */}
      <section className="bg-secondary/30 py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="text-2xl font-bold md:text-3xl">Fonctions BPEI</h2>
          <p className="mt-3 text-muted-foreground">Uniquement ce qui est réellement disponible ou en bêta. Rien de fictif.</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((cat) => (
              <Card key={cat.group}>
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{cat.group}</h3>
                  <ul className="mt-3 space-y-2">
                    {cat.items.map((it) => (
                      <li key={it.label} className="flex items-center justify-between gap-2 text-sm">
                        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-electric" />{it.label}</span>
                        <Badge className={STATUS_CLASS[it.status]}>{STATUS_LABEL[it.status]}</Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Indépendance */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 className="text-2xl font-bold md:text-3xl">Vous restez indépendant</h2>
          <p className="mt-3 text-muted-foreground">
            BPEI n'est pas une franchise. Chaque boutique conserve son entreprise, ses clients, ses prix, son identité, ses produits et ses services. Vous choisissez les fonctions que vous utilisez.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {["Votre entreprise reste la vôtre","Vos clients vous appartiennent","Vos prix restent libres","Votre identité de marque est préservée","Vous gérez vos produits et services","Vous choisissez les modules activés"].map((x) => (
              <li key={x} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-electric" />{x}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Demo form */}
      <section id="demo" className="border-t border-border bg-secondary/30 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-[1fr_1.2fr] md:px-6">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Demander une démonstration</h2>
            <p className="mt-3 text-muted-foreground">
              Un membre de l'équipe BPEI vous recontacte pour une démo personnalisée de la plateforme. Aucun engagement.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2"><Users className="mt-0.5 h-4 w-4 text-electric" />Adapté à votre équipe et vos besoins</li>
              <li className="flex gap-2"><Wrench className="mt-0.5 h-4 w-4 text-electric" />Import possible de vos clients et stock</li>
              <li className="flex gap-2"><Package className="mt-0.5 h-4 w-4 text-electric" />Isolation stricte des données entre boutiques</li>
              <li className="flex gap-2"><MessageSquare className="mt-0.5 h-4 w-4 text-electric" />Réponse sous 2 jours ouvrés</li>
            </ul>
          </div>
          <Card>
            <CardContent className="pt-6">
              {reference ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                  <h3 className="mt-4 text-lg font-semibold">Demande enregistrée</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Référence : <span className="font-mono font-semibold">{reference}</span>.<br />
                    L'équipe BPEI vous recontacte sous 2 jours ouvrés.
                  </p>
                  <Button className="mt-6" variant="outline" onClick={() => setReference(null)}>Nouvelle demande</Button>
                </div>
              ) : (
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Prénom *" error={form.formState.errors.first_name?.message}><Input {...form.register("first_name")} /></Field>
                    <Field label="Nom *" error={form.formState.errors.last_name?.message}><Input {...form.register("last_name")} /></Field>
                  </div>
                  <Field label="Nom de la boutique *" error={form.formState.errors.shop_name?.message}><Input {...form.register("shop_name")} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ville" error={form.formState.errors.city?.message as string | undefined}><Input {...form.register("city")} /></Field>
                    <Field label="Nb d'établissements" error={form.formState.errors.establishments_count?.message as string | undefined}>
                      <Input type="number" min={1} {...form.register("establishments_count")} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="E-mail *" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
                    <Field label="Téléphone *" error={form.formState.errors.phone?.message}><Input type="tel" {...form.register("phone")} /></Field>
                  </div>
                  <Field label="Créneau souhaité" error={form.formState.errors.preferred_slot?.message as string | undefined}>
                    <Input placeholder="ex. mardi après-midi" {...form.register("preferred_slot")} />
                  </Field>
                  <Field label="Message" error={form.formState.errors.message?.message as string | undefined}>
                    <Textarea rows={3} {...form.register("message")} />
                  </Field>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      aria-label="J'accepte d'être recontacté par l'équipe BPEI"
                      checked={form.watch("consent")}
                      onCheckedChange={(v) => form.setValue("consent", !!v, { shouldValidate: true })}
                    />
                    <span>J'accepte d'être recontacté par l'équipe BPEI concernant cette demande.</span>
                  </label>
                  {form.formState.errors.consent && <p className="text-xs text-destructive">{form.formState.errors.consent.message}</p>}
                  <Button type="submit" className="w-full bg-electric text-electric-foreground hover:bg-electric/90" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Envoi…" : "Envoyer la demande"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }> }) {
  const id = useId();
  const errId = `${id}-err`;
  const child = isValidElement(children)
    ? cloneElement(Children.only(children), {
        id: children.props.id ?? id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errId : undefined,
      })
    : children;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {child}
      {error && <p id={errId} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}