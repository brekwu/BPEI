import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PublicShell } from "@/components/public/PublicShell";
import { Field, FormSection, ChipToggle, selectClass } from "@/components/public/NetworkForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ACQUISITION_SOURCES, EXPERIENCE_LEVELS, INTERVENTION_MODES, SKILLS, TechnicianApplicationSchema, readTrackingParams, type SkillValue } from "@/lib/network-forms";
import { submitTechnicianApplication } from "@/lib/network.functions";

const PUBLIC_FORMS_ENABLED = import.meta.env.VITE_BPEI_PUBLIC_FORMS_ENABLED === "true";

export const Route = createFileRoute("/candidature-partenaire")({
  head: () => ({
    meta: [
      { title: "Candidature technicien indépendant — BPEI" },
      { name: "description", content: "Candidatez comme partenaire informatique indépendant du réseau BPEI. Collaboration freelance non salariée, sans revenu ni missions garantis." },
      { property: "og:url", content: "https://bpei.fr/candidature-partenaire" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/candidature-partenaire" }],
  }),
  component: CandidatePage,
});

type BusinessStatus = "" | "immatricule" | "en_projet";
type ApplicationForm = {
  first_name: string; last_name: string; email: string; phone: string; city: string; postal_code: string;
  business_status: BusinessStatus; siret: string; legal_form: string; skills: SkillValue[]; skills_other: string;
  experience_level: string; intervention_modes: string[]; service_radius_km: string; covered_area: string;
  availability: string; has_insurance: boolean | null; message: string; acquisition_source: string;
  referral_code: string; utm_source: string; utm_medium: string; utm_campaign: string; consent: boolean;
};
const EMPTY: ApplicationForm = {
  first_name: "", last_name: "", email: "", phone: "", city: "", postal_code: "",
  business_status: "", siret: "", legal_form: "", skills: [], skills_other: "", experience_level: "",
  intervention_modes: [], service_radius_km: "", covered_area: "", availability: "",
  has_insurance: null, message: "", acquisition_source: "", referral_code: "",
  utm_source: "", utm_medium: "", utm_campaign: "", consent: false,
};

function CandidatePage() {
  const submit = useServerFn(submitTechnicianApplication);
  const [values, setValues] = useState<ApplicationForm>({ ...EMPTY });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  function set<K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) { setValues((v) => ({ ...v, [key]: value })); }

  useEffect(() => {
    const tracking = readTrackingParams(window.location.search);
    setValues((v) => ({
      ...v,
      referral_code: tracking.referral_code ?? "", utm_source: tracking.utm_source ?? "",
      utm_medium: tracking.utm_medium ?? "", utm_campaign: tracking.utm_campaign ?? "",
    }));
  }, []);

  function toggleSkill(skill: SkillValue) {
    setValues((v) => ({
      ...v,
      skills: v.skills.includes(skill) ? v.skills.filter((s) => s !== skill) : [...v.skills, skill],
    }));
  }
  function toggleMode(mode: string) {
    setValues((v) => ({
      ...v,
      intervention_modes: v.intervention_modes.includes(mode) ? v.intervention_modes.filter((s) => s !== mode) : [...v.intervention_modes, mode],
    }));
  }

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError("");
    const parsed = TechnicianApplicationSchema.safeParse({
      ...values,
      siret: values.business_status === "immatricule" ? values.siret : null,
      legal_form: values.business_status === "immatricule" ? values.legal_form || null : null,
      skills_other: values.skills_other || null,
      experience_level: values.experience_level || null,
      service_radius_km: values.service_radius_km ? Number(values.service_radius_km) : null,
      covered_area: values.covered_area || null, availability: values.availability || null,
      message: values.message || null, acquisition_source: values.acquisition_source || null,
      referral_code: values.referral_code || null,
      utm_source: values.utm_source || null, utm_medium: values.utm_medium || null, utm_campaign: values.utm_campaign || null,
    });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Vérifiez votre candidature."); return; }
    setPending(true);
    try {
      const result = await submit({ data: parsed.data });
      setReference(result.reference);
      toast.success("Candidature enregistrée");
    } catch {
      setError("Votre candidature n'a pas pu être enregistrée. Réessayez plus tard.");
    } finally { setPending(false); }
  }

  return (
    <PublicShell>
      <section className="border-b bg-secondary/30 py-12">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h1 className="text-3xl font-bold md:text-5xl">Rejoindre le réseau BPEI</h1>
          <p className="mt-4 max-w-3xl text-muted-foreground">Candidature gratuite pour techniciens informatiques indépendants et futurs entrepreneurs. Il s'agit d'un partenariat freelance, pas d'un contrat salarié. Aucun revenu ou volume de missions n'est garanti.</p>
        </div>
      </section>
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-[minmax(0,1fr)_260px] md:px-6">
        <section className="rounded-2xl border bg-card p-5 md:p-8">
          {!PUBLIC_FORMS_ENABLED ? (
            <div role="status" className="py-12 text-center">
              <h2 className="text-2xl font-bold">Ouverture prochainement</h2>
              <p className="mt-4 text-muted-foreground">Les candidatures seront accessibles après validation de notre politique de confidentialité et de notre infrastructure.</p>
              <Link to="/contact" className="mt-6 inline-block underline">Nous contacter</Link>
            </div>
          ) : reference ? (
            <div role="status" className="py-12 text-center">
              <h2 className="text-2xl font-bold">Votre candidature est enregistrée</h2>
              <p className="mt-4 text-muted-foreground">Référence : <strong className="font-mono">{reference}</strong></p>
              <p className="mt-3 text-sm text-muted-foreground">Notre équipe étudie votre profil. Aucun accès aux missions n'est activé automatiquement.</p>
              <Link to="/devenir-partenaire" className="mt-6 inline-block underline">Retour au recrutement</Link>
            </div>
          ) : (
            <form className="space-y-8" onSubmit={send}>
              <FormSection step={1} title="Votre situation professionnelle">
                <Field label="Votre statut *">
                  <select className={selectClass} required value={values.business_status} onChange={(e) => set("business_status", e.target.value as BusinessStatus)}>
                    <option value="">Sélectionnez</option>
                    <option value="immatricule">Indépendant déjà immatriculé</option>
                    <option value="en_projet">En projet de création d'entreprise</option>
                  </select>
                </Field>
                {values.business_status === "immatricule" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="SIRET (14 chiffres)"><Input inputMode="numeric" maxLength={20} value={values.siret} onChange={(e) => set("siret", e.target.value)} /></Field>
                    <Field label="Forme juridique"><Input maxLength={80} placeholder="Micro-entreprise, SASU..." value={values.legal_form} onChange={(e) => set("legal_form", e.target.value)} /></Field>
                  </div>
                )}
                <Field label="Expérience">
                  <select className={selectClass} value={values.experience_level} onChange={(e) => set("experience_level", e.target.value)}>
                    <option value="">Non précisée</option>{EXPERIENCE_LEVELS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </Field>
              </FormSection>
              <FormSection step={2} title="Compétences et zone d'intervention" desc="Sélectionnez au moins une compétence.">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Compétences">
                  {SKILLS.map((skill) => <ChipToggle key={skill.value} active={values.skills.includes(skill.value)} onClick={() => toggleSkill(skill.value)}>{skill.label}</ChipToggle>)}
                </div>
                <Field label="Autres compétences"><Input maxLength={500} value={values.skills_other} onChange={(e) => set("skills_other", e.target.value)} /></Field>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Modes d'intervention">
                  {INTERVENTION_MODES.map((mode) => <ChipToggle key={mode.value} active={values.intervention_modes.includes(mode.value)} onClick={() => toggleMode(mode.value)}>{mode.label}</ChipToggle>)}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Code postal *"><Input required maxLength={5} inputMode="numeric" value={values.postal_code} onChange={(e) => set("postal_code", e.target.value)} /></Field>
                  <Field label="Ville *"><Input required maxLength={120} value={values.city} onChange={(e) => set("city", e.target.value)} /></Field>
                  <Field label="Rayon d'action (km)"><Input type="number" min={0} max={1000} value={values.service_radius_km} onChange={(e) => set("service_radius_km", e.target.value)} /></Field>
                  <Field label="Villes ou secteurs couverts"><Input maxLength={500} value={values.covered_area} onChange={(e) => set("covered_area", e.target.value)} /></Field>
                </div>
                <Field label="Disponibilités"><Input maxLength={300} value={values.availability} onChange={(e) => set("availability", e.target.value)} /></Field>
                <Field label="Assurance RC professionnelle">
                  <select className={selectClass} value={values.has_insurance === null ? "" : values.has_insurance ? "oui" : "non"} onChange={(e) => set("has_insurance", e.target.value === "" ? null : e.target.value === "oui")}>
                    <option value="">Non précisé</option><option value="oui">Oui</option><option value="non">Pas encore</option>
                  </select>
                </Field>
              </FormSection>
              <FormSection step={3} title="Vos coordonnées">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Prénom *"><Input required autoComplete="given-name" maxLength={80} value={values.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
                  <Field label="Nom *"><Input required autoComplete="family-name" maxLength={80} value={values.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
                  <Field label="E-mail *"><Input type="email" required autoComplete="email" maxLength={255} value={values.email} onChange={(e) => set("email", e.target.value)} /></Field>
                  <Field label="Téléphone *"><Input type="tel" required autoComplete="tel" maxLength={30} value={values.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
                </div>
                <Field label="Présentation libre"><Textarea maxLength={2000} rows={4} value={values.message} onChange={(e) => set("message", e.target.value)} placeholder="Votre expérience, votre activité, vos points forts..." /></Field>
              </FormSection>
              <FormSection step={4} title="Provenance et accord">
                <Field label="Comment avez-vous connu BPEI ?">
                  <select className={selectClass} value={values.acquisition_source} onChange={(e) => set("acquisition_source", e.target.value)}>
                    <option value="">Non précisé</option>{ACQUISITION_SOURCES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                </Field>
                <Field label="Code de parrainage (facultatif)"><Input maxLength={60} value={values.referral_code} onChange={(e) => set("referral_code", e.target.value)} /></Field>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" required checked={values.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1" />
                  <span>J'accepte que BPEI utilise mes données pour étudier ma candidature et me recontacter. Voir la <Link to="/confidentialite" className="underline">confidentialité</Link>.</span>
                </label>
              </FormSection>
              {error && <p role="alert" className="rounded border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "Envoi…" : "Envoyer ma candidature"}</Button>
            </form>
          )}
        </section>
        <aside className="rounded-xl border bg-card p-6 text-sm text-muted-foreground self-start">
          <h2 className="font-bold text-foreground">Un partenariat indépendant</h2>
          <p className="mt-3">Une candidature n'est pas une embauche. L'identité, l'immatriculation et l'assurance du partenaire seront vérifiées avant toute mission.</p>
          <p className="mt-3">Vous êtes libre d'accepter ou de refuser les opportunités proposées. Aucun volume de travail n'est promis.</p>
          <Link to="/comment-ca-marche" className="mt-4 inline-block underline">Questions fréquentes</Link>
        </aside>
      </div>
    </PublicShell>
  );
}
