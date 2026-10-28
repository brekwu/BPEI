import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Children, cloneElement, isValidElement, useEffect, useId, useState, type ReactElement } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PublicShell } from "@/components/public/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitContact } from "@/lib/site.functions";
import { supabase } from "@/integrations/supabase/client";
import { getPublicLegalIdentityFn } from "@/lib/platform-public.functions";
import { getPublicPlatformSettingsFn } from "@/lib/platform-public.functions";
import { Mail, Phone, MapPin, CheckCircle2, Store } from "lucide-react";

const searchSchema = z.object({
  shop: z.string().uuid().optional(),
  subject: z.enum(["particulier","boutique","rejoindre","support","commercial","reclamation","autre"]).optional(),
});

export const Route = createFileRoute("/contact")({
  loader: async () => {
    const [settings, identity] = await Promise.all([
      getPublicPlatformSettingsFn(),
      getPublicLegalIdentityFn(),
    ]);
    // Coordonnées publiques : préférer platform_public_settings.contact ; fallback identité légale.
    const contact = settings.contact ?? {};
    return {
      email: contact.email ?? identity?.professional_email ?? null,
      support_email: contact.support_email ?? identity?.support_email ?? null,
      phone: contact.phone ?? identity?.professional_phone ?? null,
      address: contact.address ?? null,
    };
  },
  head: () => ({
    meta: [
      { title: "Contact — BPEI" },
      { name: "description", content: "Contactez l'équipe BPEI : questions, adhésion, support technique, réclamations. Réponse par référence de dossier." },
      { property: "og:title", content: "Contacter BPEI" },
      { property: "og:description", content: "Un formulaire unique pour toutes vos demandes : particulier, boutique, réclamation, technique ou commercial." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bpei.fr/contact" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/contact" }],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: ContactPage,
});

const SUBJECTS = [
  { value: "particulier", label: "Je suis un particulier" },
  { value: "boutique", label: "Je représente une boutique" },
  { value: "rejoindre", label: "Je souhaite rejoindre BPEI" },
  { value: "support", label: "J'ai un problème technique" },
  { value: "commercial", label: "J'ai une question commerciale" },
  { value: "reclamation", label: "Je souhaite faire une réclamation" },
  { value: "autre", label: "Autre" },
] as const;

const schema = z.object({
  subject_kind: z.enum(["particulier","boutique","rejoindre","support","commercial","reclamation","autre"]),
  first_name: z.string().trim().min(1, "Requis").max(80),
  last_name: z.string().trim().min(1, "Requis").max(80),
  email: z.string().trim().email("E-mail invalide").max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  shop_name: z.string().trim().max(160).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Minimum 10 caractères").max(4000),
  consent: z.boolean().refine((v) => v === true, { message: "Consentement requis" }),
});
type Form = z.infer<typeof schema>;

function ContactPage() {
  const search = Route.useSearch() as { shop?: string; subject?: string };
  const contactInfo = Route.useLoaderData();
  const submit = useServerFn(submitContact);
  const [reference, setReference] = useState<string | null>(null);
  const [prefillShop, setPrefillShop] = useState<{ id: string; name: string; city: string | null } | null>(null);

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { subject_kind: (search.subject as any) ?? "particulier", consent: false as any },
  });

  useEffect(() => {
    if (!search.shop) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("shops_public")
        .select("id, name, city")
        .eq("id", search.shop!)
        .maybeSingle();
      if (cancelled || !data) return;
      setPrefillShop(data as any);
      form.setValue("shop_name", data.name ?? "");
      if (data.city) form.setValue("city", data.city);
      form.setValue("subject_kind", "particulier");
    })();
    return () => { cancelled = true; };
  }, [search.shop]);

  async function onSubmit(v: Form) {
    try {
      const res = await submit({ data: {
        subject_kind: v.subject_kind,
        first_name: v.first_name, last_name: v.last_name, email: v.email,
        phone: v.phone || null, shop_name: v.shop_name || null, city: v.city || null,
        shop_id: prefillShop?.id ?? null,
        origin_path: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
        message: v.message, consent: true,
      } });
      setReference(res.reference);
      form.reset({ subject_kind: "particulier", consent: false as any });
      toast.success(`Demande enregistrée : ${res.reference}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold md:text-4xl">Contactez BPEI</h1>
          <p className="mt-3 text-muted-foreground">
            Un formulaire unique pour toutes vos demandes. Vous recevrez une référence de suivi.
          </p>
        </div>

        {prefillShop && (
          <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-electric/40 bg-electric/5 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <Store className="h-4 w-4 text-electric" />
              Votre demande concerne : <span className="text-electric">{prefillShop.name}</span>
              {prefillShop.city && <span className="text-muted-foreground">— {prefillShop.city}</span>}
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold">Coordonnées</h3>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {contactInfo.email ? (
                    <li className="flex items-start gap-2"><Mail className="mt-0.5 h-4 w-4 text-electric" /><a href={`mailto:${contactInfo.email}`} className="hover:text-foreground">{contactInfo.email}</a></li>
                  ) : (
                    <li className="text-xs italic">L'adresse e-mail publique BPEI sera renseignée prochainement.</li>
                  )}
                  {contactInfo.phone && <li className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-electric" /><a href={`tel:${contactInfo.phone}`} className="hover:text-foreground">{contactInfo.phone}</a></li>}
                  {contactInfo.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-electric" />{contactInfo.address}</li>}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold">Support</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Toutes les demandes sont enregistrées et traitées par l'équipe BPEI. Vous obtenez une référence de suivi (ex. <code className="font-mono">CONTACT-XXXX</code>) à conserver.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="pt-6">
              {reference ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                  <h3 className="mt-4 text-lg font-semibold">Demande enregistrée</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Votre demande a bien été enregistrée sous la référence <span className="font-mono font-semibold">{reference}</span>.
                  </p>
                  <Button className="mt-6" variant="outline" onClick={() => setReference(null)}>Nouvelle demande</Button>
                </div>
              ) : (
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sujet *</Label>
                    <Select value={form.watch("subject_kind")} onValueChange={(v) => form.setValue("subject_kind", v as any)}>
                      <SelectTrigger aria-label="Sujet du message"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Prénom *" error={form.formState.errors.first_name?.message}><Input {...form.register("first_name")} /></Field>
                    <Field label="Nom *" error={form.formState.errors.last_name?.message}><Input {...form.register("last_name")} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="E-mail *" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
                    <Field label="Téléphone" error={form.formState.errors.phone?.message as string | undefined}><Input type="tel" {...form.register("phone")} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={prefillShop ? "Boutique concernée" : "Boutique"} error={form.formState.errors.shop_name?.message as string | undefined}>
                      <Input {...form.register("shop_name")} readOnly={!!prefillShop} className={prefillShop ? "bg-muted" : ""} />
                    </Field>
                    <Field label="Ville" error={form.formState.errors.city?.message as string | undefined}><Input {...form.register("city")} /></Field>
                  </div>
                  <Field label="Message *" error={form.formState.errors.message?.message}>
                    <Textarea rows={5} {...form.register("message")} placeholder={prefillShop ? `Votre question à propos de ${prefillShop.name}…` : ""} />
                  </Field>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      aria-label="J'accepte le traitement de ma demande"
                      checked={form.watch("consent")}
                      onCheckedChange={(v) => form.setValue("consent", !!v, { shouldValidate: true })}
                    />
                    <span>J'accepte que BPEI enregistre et traite ma demande. Voir la <a href="/confidentialite" className="underline">politique de confidentialité</a>.</span>
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
      </div>
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