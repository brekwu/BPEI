import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PublicShell } from "@/components/public/PublicShell";
import { Field, FormSection, selectClass } from "@/components/public/NetworkForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ACQUISITION_SOURCES, DEVICE_TYPES, PROBLEM_CATEGORIES, InterventionRequestSchema, readTrackingParams } from "@/lib/network-forms";
import { submitInterventionRequest } from "@/lib/network.functions";

const PUBLIC_FORMS_ENABLED = import.meta.env.VITE_BPEI_PUBLIC_FORMS_ENABLED === "true";

export const Route = createFileRoute("/demander-une-intervention")({
  head: () => ({
    meta: [
      { title: "Demander une intervention informatique — BPEI" },
      { name: "description", content: "Décrivez votre panne informatique. BPEI vérifie si un technicien indépendant peut vous aider dans votre zone, sans garantie de prise en charge." },
      { property: "og:url", content: "https://bpei.fr/demander-une-intervention" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/demander-une-intervention" }],
  }),
  component: InterventionPage,
});

type ClientForm = {
  requester_type: "particulier" | "professionnel"; company_name: string;
  first_name: string; last_name: string; email: string; phone: string;
  city: string; postal_code: string; device_type: string; problem_category: string;
  description: string; preferred_mode: "domicile" | "a_distance" | "indifferent";
  urgency: "rapide" | "cette_semaine" | "flexible"; availability: string;
  acquisition_source: string; referral_code: string; utm_source: string;
  utm_medium: string; utm_campaign: string; consent: boolean;
};

const EMPTY: ClientForm = {
  requester_type: "particulier", company_name: "", first_name: "", last_name: "", email: "", phone: "",
  city: "", postal_code: "", device_type: "", problem_category: "", description: "",
  preferred_mode: "indifferent", urgency: "flexible", availability: "",
  acquisition_source: "", referral_code: "", utm_source: "", utm_medium: "", utm_campaign: "", consent: false,
};

function InterventionPage() {
  const submit = useServerFn(submitInterventionRequest);
  const [values, setValues] = useState<ClientForm>({ ...EMPTY });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  function set<K extends keyof ClientForm>(key: K, value: ClientForm[K]) { setValues((v) => ({ ...v, [key]: value })); }

  useEffect(() => {
    const t = readTrackingParams(window.location.search);
    setValues((v) => ({
      ...v,
      referral_code: t.referral_code ?? "", utm_source: t.utm_source ?? "",
      utm_medium: t.utm_medium ?? "", utm_campaign: t.utm_campaign ?? "",
    }));
  }, []);

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError("");
    const parsed = InterventionRequestSchema.safeParse({
      ...values,
      company_name: values.requester_type === "professionnel" ? values.company_name || null : null,
      device_type: values.device_type || null, problem_category: values.problem_category || null,
      availability: values.availability || null, acquisition_source: values.acquisition_source || null,
      referral_code: values.referral_code || null,
      utm_source: values.utm_source || null, utm_medium: values.utm_medium || null, utm_campaign: values.utm_campaign || null,
    });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Vérifiez les champs."); return; }
    setPending(true);
    try {
      const result = await submit({ data: parsed.data });
      setReference(result.reference);
      toast.success("Demande reçue");
    } catch {
      setError("Impossible d'enregistrer votre demande pour l'instant. Réessayez ultérieurement.");
    } finally { setPending(false); }
  }

  return (
    <PublicShell>
      <section className="border-b bg-secondary/30 py-12">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h1 className="text-3xl font-bold md:text-5xl">Demander une intervention informatique</h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">La demande est gratuite et sans engagement. Le réseau est en constitution : nous vous recontactons seulement si nous pouvons étudier une prise en charge. Aucune intervention n'est garantie.</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-[minmax(0,1fr)_260px] md:px-6">
        <section className="rounded-2xl border bg-card p-5 md:p-8">
          {!PUBLIC_FORMS_ENABLED ? (
            <div role="status" className="py-12 text-center">
              <h2 className="text-2xl font-bold">Ouverture prochainement</h2>
              <p className="mt-4 text-muted-foreground">Les demandes d’intervention seront accessibles après validation de notre politique de confidentialité et de notre infrastructure.</p>
              <Link to="/contact" className="mt-6 inline-block underline">Nous contacter</Link>
            </div>
          ) : reference ? (
            <div role="status" className="py-12 text-center">
              <h2 className="text-2xl font-bold">Votre demande est enregistrée</h2>
              <p className="mt-4 text-muted-foreground">Référence : <strong className="font-mono">{reference}</strong></p>
              <p className="mt-3 text-sm text-muted-foreground">Cette confirmation ne constitue ni un devis ni une réservation.</p>
              <Button type="button" className="mt-6" onClick={() => { setReference(""); setValues({ ...EMPTY }); }}>Nouvelle demande</Button>
            </div>
          ) : (
            <form onSubmit={send} className="space-y-8">
              <FormSection step={1} title="Votre problème">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Vous êtes">
                    <select className={selectClass} value={values.requester_type} onChange={(e) => set("requester_type", e.target.value as ClientForm["requester_type"])}>
                      <option value="particulier">Particulier</option><option value="professionnel">Professionnel</option>
                    </select>
                  </Field>
                  {values.requester_type === "professionnel" && <Field label="Entreprise"><Input maxLength={160} value={values.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>}
                  <Field label="Appareil">
                    <select className={selectClass} value={values.device_type} onChange={(e) => set("device_type", e.target.value)}>
                      <option value="">Sélectionner</option>{DEVICE_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Type de problème">
                    <select className={selectClass} value={values.problem_category} onChange={(e) => set("problem_category", e.target.value)}>
                      <option value="">Sélectionner</option>{PROBLEM_CATEGORIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Expliquez votre problème *"><Textarea required minLength={10} maxLength={4000} rows={5} value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="Décrivez les symptômes, sans communiquer de mot de passe." /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Mode souhaité">
                    <select className={selectClass} value={values.preferred_mode} onChange={(e) => set("preferred_mode", e.target.value as ClientForm["preferred_mode"])}>
                      <option value="indifferent">Sans préférence</option><option value="domicile">Sur place</option><option value="a_distance">À distance</option>
                    </select>
                  </Field>
                  <Field label="Délai souhaité">
                    <select className={selectClass} value={values.urgency} onChange={(e) => set("urgency", e.target.value as ClientForm["urgency"])}>
                      <option value="flexible">Flexible</option><option value="cette_semaine">Cette semaine</option><option value="rapide">Dès que possible</option>
                    </select>
                  </Field>
                </div>
                <Field label="Disponibilités"><Input maxLength={300} value={values.availability} onChange={(e) => set("availability", e.target.value)} /></Field>
              </FormSection>
              <FormSection step={2} title="Vos coordonnées">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Code postal *"><Input required maxLength={5} inputMode="numeric" value={values.postal_code} onChange={(e) => set("postal_code", e.target.value)} /></Field>
                  <Field label="Ville *"><Input required maxLength={120} value={values.city} onChange={(e) => set("city", e.target.value)} /></Field>
                  <Field label="Prénom *"><Input required maxLength={80} autoComplete="given-name" value={values.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
                  <Field label="Nom *"><Input required maxLength={80} autoComplete="family-name" value={values.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
                  <Field label="E-mail *"><Input type="email" required maxLength={255} autoComplete="email" value={values.email} onChange={(e) => set("email", e.target.value)} /></Field>
                  <Field label="Téléphone *"><Input type="tel" required maxLength={30} autoComplete="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
                </div>
              </FormSection>
              <FormSection step={3} title="Provenance et consentement">
                <Field label="Comment avez-vous découvert BPEI ?">
                  <select className={selectClass} value={values.acquisition_source} onChange={(e) => set("acquisition_source", e.target.value)}>
                    <option value="">Non précisé</option>{ACQUISITION_SOURCES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </Field>
                <Field label="Code de parrainage (facultatif)"><Input maxLength={60} value={values.referral_code} onChange={(e) => set("referral_code", e.target.value)} /></Field>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" required checked={values.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1" />
                  <span>J'accepte que BPEI utilise ces informations pour traiter ma demande et me recontacter. Voir la <Link to="/confidentialite" className="underline">politique de confidentialité</Link>.</span>
                </label>
              </FormSection>
              {error && <p role="alert" className="rounded border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "Envoi…" : "Envoyer ma demande"}</Button>
            </form>
          )}
        </section>
        <aside className="rounded-xl border bg-card p-6 text-sm text-muted-foreground self-start">
          <h2 className="font-bold text-foreground">Comment ça fonctionne ?</h2>
          <p className="mt-3">BPEI examine votre besoin et votre secteur. Si un indépendant vérifié est disponible, nous vous communiquerons la suite.</p>
          <p className="mt-3">Aucun paiement demandé lors de ce formulaire. Ne transmettez pas de données bancaires ni de mots de passe.</p>
          <Link to="/comment-ca-marche" className="mt-4 inline-block underline">En savoir plus</Link>
        </aside>
      </div>
    </PublicShell>
  );
}
