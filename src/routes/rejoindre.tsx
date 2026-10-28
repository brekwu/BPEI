import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { BETA_END_LABEL } from "@/lib/pricing-plans";
import { CheckCircle2, Store, Home, Building2, Network, Clock, Loader2, Save, Trash2 } from "lucide-react";

const LOCAL_REF_KEY = "bpei_application_reference_v1";
const DRAFT_PREFIX = "bpei_application_draft_v1__";

const STATUS_LABELS: Record<string, { label: string; description: string }> = {
  nouvelle: { label: "Reçue — en attente d'examen", description: "BPEI examine votre dossier. Vous serez recontacté sous quelques jours ouvrés." },
  en_cours: { label: "En cours d'examen", description: "Votre dossier est en cours d'analyse par l'équipe BPEI." },
  info_demandee: { label: "Informations complémentaires demandées", description: "BPEI vous a contacté pour obtenir des informations supplémentaires. Consultez vos emails." },
  invitation_envoyee: { label: "Invitation envoyée", description: "Une invitation d'accès a été envoyée à votre email. Ouvrez-la pour créer votre mot de passe et accéder à votre espace." },
  acces_active: { label: "Accès activé", description: "Votre accès est actif. Connectez-vous pour rejoindre votre espace BPEI." },
  refusee: { label: "Candidature refusée", description: "Votre candidature n'a pas été retenue. Pour toute question, contactez-nous." },
  archivee: { label: "Candidature archivée", description: "Cette candidature a été archivée." },
};

const TERMINAL_STATUSES = new Set(["refusee", "archivee"]);

export const Route = createFileRoute("/rejoindre")({
  head: () => ({
    meta: [
      { title: "Rejoindre BPEI — Candidature" },
      { name: "description", content: `Candidatez pour rejoindre la bêta BPEI. Boutiques physiques et indépendants à domicile. Gratuit jusqu'au ${BETA_END_LABEL}.` },
      { property: "og:title", content: "Rejoindre BPEI — Candidature bêta" },
      { property: "og:description", content: `Rejoignez le réseau BPEI. Candidature ouverte aux boutiques et indépendants. Gratuit jusqu'au ${BETA_END_LABEL}.` },
      { property: "og:url", content: "https://bpei.fr/rejoindre" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/rejoindre" }],
  }),
  component: JoinPage,
});


type BizType = "physical_shop" | "mobile_independent" | "hybrid_business" | "multi_location_network";

// -------- Schémas par type --------
const strOpt = z.string().trim().max(200).optional().or(z.literal(""));
const optNum = (max = 9999) => z.preprocess(
  (v) => v === "" || v == null ? undefined : v,
  z.coerce.number().int().min(0).max(max).optional(),
);

const commonBase = {
  contact_first_name: z.string().trim().min(1, "Prénom requis").max(60),
  contact_last_name: z.string().trim().min(1, "Nom requis").max(60),
  contact_email: z.string().trim().email("Email invalide").max(255),
  contact_phone: z.string().trim().min(6, "Téléphone requis").max(30),
  commercial_name: z.string().trim().min(2, "Nom commercial requis").max(160),
  legal_name: strOpt, legal_form: strOpt,
  siren: z.string().trim().regex(/^\d{9}$/, "SIREN : 9 chiffres").optional().or(z.literal("")),
  siret: z.string().trim().regex(/^\d{14}$/, "SIRET : 14 chiffres").optional().or(z.literal("")),
  vat_number: strOpt,
  website: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  main_services: z.string().trim().max(500).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
  consent_contact: z.literal(true, { message: "Consentement requis" }),
};

const shopAddress = {
  address: z.string().trim().min(3, "Adresse requise").max(200),
  postal_code: z.string().trim().min(3, "Code postal requis").max(20),
  city: z.string().trim().min(2, "Ville requise").max(80),
};

const schemas: Record<BizType, z.ZodTypeAny> = {
  physical_shop: z.object({
    ...commonBase, ...shopAddress,
    employees_count: optNum(9999),
  }),
  mobile_independent: z.object({
    ...commonBase, ...shopAddress,
    covered_cities: z.string().trim().max(500).optional().or(z.literal("")),
    covered_postal_codes: z.string().trim().max(500).optional().or(z.literal("")),
    service_radius_km: optNum(1000),
    travel_fee_policy: z.string().trim().max(200).optional().or(z.literal("")),
    insurance_provider: z.string().trim().min(2, "Assureur requis").max(160),
    insurance_policy_number: z.string().trim().max(120).optional().or(z.literal("")),
    professional_experience_years: optNum(60),
    users_count: optNum(50),
  }).refine((d) => {
    const hasCities = (d.covered_cities || "").split(",").map(s => s.trim()).filter(Boolean).length > 0;
    const hasRadius = typeof d.service_radius_km === "number" && d.service_radius_km > 0;
    return hasCities || hasRadius;
  }, { message: "Renseignez au moins une ville couverte ou un rayon d'intervention.", path: ["covered_cities"] }),
  hybrid_business: z.object({
    ...commonBase, ...shopAddress,
    covered_cities: z.string().trim().max(500).optional().or(z.literal("")),
    covered_postal_codes: z.string().trim().max(500).optional().or(z.literal("")),
    service_radius_km: optNum(1000),
    travel_fee_policy: z.string().trim().max(200).optional().or(z.literal("")),
    insurance_provider: z.string().trim().min(2, "Assureur requis").max(160),
    insurance_policy_number: z.string().trim().max(120).optional().or(z.literal("")),
    employees_count: optNum(9999),
  }).refine((d) => {
    const hasCities = (d.covered_cities || "").split(",").map(s => s.trim()).filter(Boolean).length > 0;
    const hasRadius = typeof d.service_radius_km === "number" && d.service_radius_km > 0;
    return hasCities || hasRadius;
  }, { message: "Renseignez la zone d'intervention (villes ou rayon).", path: ["covered_cities"] }),
  multi_location_network: z.object({
    ...commonBase, ...shopAddress,
    establishments_count: z.preprocess((v) => v === "" || v == null ? undefined : v,
      z.coerce.number().int().min(2, "Au moins 2 établissements").max(999)),
    employees_count: optNum(99999),
  }),
};

const EMPTY: Record<string, string> = {
  contact_first_name: "", contact_last_name: "", contact_email: "", contact_phone: "",
  commercial_name: "", legal_name: "", legal_form: "", siren: "", siret: "", vat_number: "",
  address: "", postal_code: "", city: "", website: "", description: "", main_services: "", message: "",
  establishments_count: "", employees_count: "", users_count: "",
  covered_cities: "", covered_postal_codes: "", service_radius_km: "",
  travel_fee_policy: "", insurance_provider: "", insurance_policy_number: "",
  professional_experience_years: "",
};

function JoinPage() {
  const [bizType, setBizType] = useState<BizType | null>(null);
  const [values, setValues] = useState<Record<string, string>>(EMPTY);
  const [wantsPartner, setWantsPartner] = useState(false);
  const [wantsSubc, setWantsSubc] = useState(false);
  const [wantsMaint, setWantsMaint] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"form" | "review">("form");
  const [existingApp, setExistingApp] = useState<{
    reference: string; status: string; contact_email: string; commercial_name: string; created_at: string;
  } | null>(null);

  const draftKey = bizType ? `${DRAFT_PREFIX}${bizType}` : null;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Source de vérité serveur au mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { data, error } = await supabase.rpc("get_my_application");
        if (!cancelled) {
          if (!error && Array.isArray(data) && data.length > 0) {
            const app = data[0] as { reference: string; status: string; contact_email: string; commercial_name: string; created_at: string };
            if (!TERMINAL_STATUSES.has(app.status)) setExistingApp(app);
          }
          setLoadingExisting(false);
        }
      } else {
        try {
          const stored = typeof window !== "undefined" ? window.localStorage.getItem(LOCAL_REF_KEY) : null;
          if (stored && !cancelled) setReference(stored);
        } catch { /* ignore */ }
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Charger brouillon quand bizType change
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { values?: Record<string, string>; wantsPartner?: boolean; wantsSubc?: boolean; wantsMaint?: boolean; savedAt?: string };
        setValues({ ...EMPTY, ...(parsed.values || {}) });
        setWantsPartner(!!parsed.wantsPartner);
        setWantsSubc(!!parsed.wantsSubc);
        setWantsMaint(!!parsed.wantsMaint);
        if (parsed.savedAt) setSavedAt(new Date(parsed.savedAt));
        setDraftRestored(true);
      } else {
        setDraftRestored(false);
        setSavedAt(null);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Auto-save brouillon (debounce 600 ms)
  useEffect(() => {
    if (!draftKey) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const now = new Date();
        window.localStorage.setItem(draftKey, JSON.stringify({
          values, wantsPartner, wantsSubc, wantsMaint, savedAt: now.toISOString(),
        }));
        setSavedAt(now);
      } catch { /* ignore */ }
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draftKey, values, wantsPartner, wantsSubc, wantsMaint]);

  function setV(k: string, v: string) { setValues((s) => ({ ...s, [k]: v })); }
  function clearDraft() {
    if (!draftKey) return;
    try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
    setValues(EMPTY); setWantsPartner(false); setWantsSubc(false); setWantsMaint(false);
    setDraftRestored(false); setSavedAt(null);
    toast.success("Brouillon effacé");
  }

  function validate(): { ok: true } | { ok: false } {
    if (!bizType) { toast.error("Sélectionnez votre type d'activité"); return { ok: false }; }
    const parsed = schemas[bizType].safeParse({ ...values, consent_contact: consent });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = String(issue.path[0] ?? "_");
        if (!map[k]) map[k] = issue.message;
      }
      setErrors(map);
      toast.error(parsed.error.issues[0].message);
      // Scroll au premier champ en erreur
      setTimeout(() => {
        const first = parsed.error.issues[0]?.path[0];
        if (first) document.getElementById(String(first))?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return { ok: false };
    }
    setErrors({});
    return { ok: true };
  }

  function onReview(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (validate().ok) { setStep("review"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  }

  async function onSubmit() {
    if (!bizType) return;
    if (!validate().ok) { setStep("form"); return; }
    setSubmitting(true);
    const cities = (values.covered_cities || "").split(",").map((s) => s.trim()).filter(Boolean);
    const postalCodes = (values.covered_postal_codes || "").split(",").map((s) => s.trim()).filter(Boolean);
    const payload: Record<string, unknown> = {
      ...values,
      business_type: bizType,
      covered_cities: cities,
      covered_postal_codes: postalCodes,
      wants_partnerships: wantsPartner ? "true" : "false",
      wants_subcontracting: wantsSubc ? "true" : "false",
      wants_maintenance_contracts: wantsMaint ? "true" : "false",
      consent_contact: "true",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc("submit_shop_application", { _data: payload as any });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    const ref = data as string;
    setReference(ref);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(LOCAL_REF_KEY, ref);
      if (draftKey) window.localStorage.removeItem(draftKey);
    } catch { /* ignore */ }
    toast.success("Candidature envoyée");
  }

  const showShop = useMemo(() => bizType === "physical_shop" || bizType === "hybrid_business" || bizType === "multi_location_network", [bizType]);
  const showIndep = useMemo(() => bizType === "mobile_independent" || bizType === "hybrid_business", [bizType]);
  const showNetwork = useMemo(() => bizType === "multi_location_network", [bizType]);

  if (loadingExisting) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 py-16">
          <div className="mx-auto max-w-2xl px-4 md:px-6 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            <p className="mt-3 text-sm">Chargement…</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (existingApp) {
    const info = STATUS_LABELS[existingApp.status] ?? { label: existingApp.status, description: "" };
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 py-16">
          <div className="mx-auto max-w-2xl px-4 md:px-6">
            <Card>
              <CardContent className="pt-8">
                <div className="flex items-start gap-4">
                  <Clock className="h-10 w-10 shrink-0 text-electric" />
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold">Votre candidature est enregistrée</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Référence <strong className="text-foreground">{existingApp.reference}</strong>{" — "}{existingApp.commercial_name}
                    </p>
                    <div className="mt-4 rounded-md border border-border bg-secondary/40 p-4">
                      <div className="text-sm font-semibold">Statut : {info.label}</div>
                      {info.description && <p className="mt-1 text-sm text-muted-foreground">{info.description}</p>}
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <Button asChild variant="outline"><Link to="/">Retour à l'accueil</Link></Button>
                      <Button asChild variant="outline"><Link to="/contact">Nous contacter</Link></Button>
                      {existingApp.status === "acces_active" || existingApp.status === "invitation_envoyee" ? (
                        <Button asChild><Link to="/auth">Se connecter</Link></Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (reference) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 py-16">
          <div className="mx-auto max-w-2xl px-4 md:px-6">
            <Card>
              <CardContent className="pt-8 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <h1 className="mt-4 text-2xl font-bold">Candidature enregistrée</h1>
                <p className="mt-3 text-muted-foreground">Votre référence : <strong className="text-foreground">{reference}</strong></p>
                <p className="mt-3 text-sm text-muted-foreground">
                  BPEI examine votre dossier et vous recontacte sous quelques jours ouvrés. Pendant la bêta, l'accès est gratuit jusqu'au {BETA_END_LABEL}.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <Button asChild variant="outline"><Link to="/">Retour à l'accueil</Link></Button>
                  <Button asChild><Link to="/contact">Nous contacter</Link></Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-secondary/30 py-16">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Rejoindre le réseau BPEI</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Renseignez votre type d'activité, puis complétez les informations correspondantes.
              Pendant la bêta, l'accès est gratuit jusqu'au {BETA_END_LABEL}. Aucun paiement n'est demandé.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4 md:px-6">
            <Card className="mb-6">
              <CardHeader><CardTitle>Quel est votre type d'activité ?</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <BizChoice active={bizType === "physical_shop"} onClick={() => setBizType("physical_shop")}
                    Icon={Store} title="Je possède une boutique physique"
                    desc="Un magasin ouvert au public, avec équipe et gestion en magasin." />
                  <BizChoice active={bizType === "mobile_independent"} onClick={() => setBizType("mobile_independent")}
                    Icon={Home} title="J'interviens uniquement chez mes clients"
                    desc="Indépendant, interventions à domicile, sans magasin." />
                  <BizChoice active={bizType === "hybrid_business"} onClick={() => setBizType("hybrid_business")}
                    Icon={Building2} title="Boutique + interventions"
                    desc="Une boutique et aussi des interventions à domicile." />
                  <BizChoice active={bizType === "multi_location_network"} onClick={() => setBizType("multi_location_network")}
                    Icon={Network} title="Plusieurs établissements"
                    desc="Réseau ou franchise, plusieurs boutiques." />
                </div>
              </CardContent>
            </Card>

            {bizType && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle>Votre candidature</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {savedAt ? (
                      <><Save className="h-3 w-3" /><span>Brouillon enregistré {savedAt.toLocaleTimeString()}</span></>
                    ) : null}
                    {draftRestored && (
                      <Button type="button" variant="ghost" size="sm" onClick={clearDraft} className="h-7 px-2 text-xs">
                        <Trash2 className="mr-1 h-3 w-3" />Effacer
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {draftRestored && (
                    <div className="mb-4 rounded-md border border-electric/30 bg-electric/5 p-3 text-xs text-foreground">
                      Un brouillon local a été restauré pour ce type d'activité. Vous pouvez continuer là où vous vous étiez arrêté(e).
                    </div>
                  )}
                  {step === "form" ? (
                  <form onSubmit={onReview} className="space-y-8">
                    <Section title="Responsable">
                      <div className="grid gap-4 md:grid-cols-2">
                        <F id="contact_first_name" label="Prénom *" v={values} setV={setV} err={errors} />
                        <F id="contact_last_name" label="Nom *" v={values} setV={setV} err={errors} />
                        <F id="contact_email" label="Email professionnel *" type="email" v={values} setV={setV} err={errors} />
                        <F id="contact_phone" label="Téléphone *" type="tel" v={values} setV={setV} err={errors} />
                      </div>
                    </Section>

                    <Section title={bizType === "mobile_independent" ? "Identité professionnelle" : "Entreprise"}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <F id="commercial_name" label={bizType === "mobile_independent" ? "Nom professionnel *" : "Nom commercial *"} className="md:col-span-2" v={values} setV={setV} err={errors} />
                        <F id="legal_name" label="Raison sociale" v={values} setV={setV} err={errors} />
                        <F id="legal_form" label="Forme juridique" placeholder="Auto-entreprise, SARL…" v={values} setV={setV} err={errors} />
                        <F id="siren" label="SIREN" maxLength={9} v={values} setV={setV} err={errors} />
                        <F id="siret" label="SIRET" maxLength={14} v={values} setV={setV} err={errors} />
                        <F id="vat_number" label="N° TVA intracommunautaire" v={values} setV={setV} err={errors} />
                        <F id="website" label="Site internet" type="url" placeholder="https://…" v={values} setV={setV} err={errors} />
                      </div>
                    </Section>

                    {showShop && bizType !== "mobile_independent" && (
                      <Section title={bizType === "multi_location_network" ? "Adresse du siège" : "Adresse de la boutique *"}>
                        <div className="grid gap-4 md:grid-cols-2">
                          <F id="address" label="Adresse *" className="md:col-span-2" v={values} setV={setV} err={errors} />
                          <F id="postal_code" label="Code postal *" v={values} setV={setV} err={errors} />
                          <F id="city" label="Ville *" v={values} setV={setV} err={errors} />
                        </div>
                      </Section>
                    )}
                    {bizType === "mobile_independent" && (
                      <Section title="Adresse administrative (privée) *">
                        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                          Cette adresse reste strictement privée. Elle ne sera jamais affichée sur votre page publique ni dans les résultats de recherche.
                        </p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <F id="address" label="Adresse administrative *" className="md:col-span-2" v={values} setV={setV} err={errors} />
                          <F id="postal_code" label="Code postal *" v={values} setV={setV} err={errors} />
                          <F id="city" label="Ville *" v={values} setV={setV} err={errors} />
                        </div>
                      </Section>
                    )}

                    {showIndep && (
                      <Section title={bizType === "mobile_independent" ? "Zones d'intervention *" : "Zones d'intervention (en plus de la boutique) *"}>
                        <p className="mb-3 text-xs text-muted-foreground">Renseignez au minimum une ville couverte OU un rayon d'intervention en km.</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="covered_cities">Villes couvertes (séparées par une virgule)</Label>
                            <Input id="covered_cities" value={values.covered_cities} onChange={(e) => setV("covered_cities", e.target.value)} placeholder="Nice, Cagnes-sur-Mer, Saint-Laurent-du-Var" />
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="covered_postal_codes">Codes postaux couverts (séparés par une virgule)</Label>
                            <Input id="covered_postal_codes" value={values.covered_postal_codes} onChange={(e) => setV("covered_postal_codes", e.target.value)} placeholder="06000, 06200, 06700" />
                          </div>
                          <F id="service_radius_km" label="Rayon d'intervention (km)" type="number" v={values} setV={setV} err={errors} />
                          <F id="travel_fee_policy" label="Frais de déplacement (politique)" placeholder="Ex : gratuit jusqu'à 15 km, puis 0,50 €/km" v={values} setV={setV} err={errors} />
                        </div>
                      </Section>
                    )}

                    {showNetwork && (
                      <Section title="Réseau *">
                        <div className="grid gap-4 md:grid-cols-2">
                          <F id="establishments_count" label="Nombre d'établissements *" type="number" v={values} setV={setV} err={errors} />
                          <F id="employees_count" label="Nombre total de salariés" type="number" v={values} setV={setV} err={errors} />
                        </div>
                      </Section>
                    )}

                    {!showNetwork && (
                      <Section title="Équipe">
                        <div className="grid gap-4 md:grid-cols-2">
                          {(bizType === "physical_shop" || bizType === "hybrid_business") && (
                            <F id="employees_count" label="Nombre de salariés" type="number" v={values} setV={setV} err={errors} />
                          )}
                          {bizType === "mobile_independent" && (
                            <F id="users_count" label="Nombre d'utilisateurs BPEI souhaités" type="number" v={values} setV={setV} err={errors} />
                          )}
                          {showIndep && (
                            <F id="professional_experience_years" label="Années d'expérience" type="number" v={values} setV={setV} err={errors} />
                          )}
                        </div>
                      </Section>
                    )}

                    <Section title="Activité">
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="main_services">Services principaux</Label>
                          <Textarea id="main_services" value={values.main_services} onChange={(e) => setV("main_services", e.target.value)} rows={2}
                            placeholder={bizType === "mobile_independent" ? "Dépannage informatique, installation, formation, maintenance…" : "Réparation smartphones, informatique, vente…"} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description de l'activité</Label>
                          <Textarea id="description" value={values.description} onChange={(e) => setV("description", e.target.value)} rows={3} />
                        </div>
                      </div>
                    </Section>

                    {showIndep && (
                      <Section title="Assurance professionnelle *">
                        <div className="grid gap-4 md:grid-cols-2">
                          <F id="insurance_provider" label="Assureur *" v={values} setV={setV} err={errors} />
                          <F id="insurance_policy_number" label="N° de contrat" v={values} setV={setV} err={errors} />
                        </div>
                      </Section>
                    )}

                    {showIndep && (
                      <Section title="Partenariats souhaités">
                        <div className="space-y-3">
                          <CheckboxRow checked={wantsPartner} onChange={setWantsPartner} label="Je souhaite être mis en relation avec des boutiques du réseau" />
                          <CheckboxRow checked={wantsSubc} onChange={setWantsSubc} label="Je suis intéressé(e) par des missions de sous-traitance" />
                          <CheckboxRow checked={wantsMaint} onChange={setWantsMaint} label="Je suis intéressé(e) par des contrats de maintenance récurrents" />
                        </div>
                      </Section>
                    )}

                    <Section title="Message (optionnel)">
                      <Textarea id="message" value={values.message} onChange={(e) => setV("message", e.target.value)} rows={3} />
                    </Section>

                    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
                      <Checkbox id="consent_contact" checked={consent} onCheckedChange={(v) => setConsent(Boolean(v))} />
                      <Label htmlFor="consent_contact" className="text-sm font-normal leading-relaxed">
                        J'accepte d'être recontacté(e) par BPEI au sujet de ma candidature *
                      </Label>
                    </div>

                    <Button type="submit" size="lg" className="w-full bg-electric text-electric-foreground hover:bg-electric/90" disabled={submitting}>
                      Vérifier et continuer
                    </Button>
                  </form>
                  ) : (
                    <ReviewPanel
                      bizType={bizType}
                      values={values}
                      wantsPartner={wantsPartner} wantsSubc={wantsSubc} wantsMaint={wantsMaint}
                      submitting={submitting}
                      onBack={() => { setStep("form"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      onConfirm={onSubmit}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function BizChoice({ active, onClick, Icon, title, desc }: {
  active: boolean; onClick: () => void; Icon: React.ComponentType<{ className?: string }>; title: string; desc: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${active ? "border-electric bg-electric/5 shadow-sm" : "border-border hover:border-electric/50"}`}>
      <div className={`rounded-full p-2 ${active ? "bg-electric text-electric-foreground" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function F({ id, label, type = "text", className, placeholder, maxLength, v, setV, err }: {
  id: string; label: string; type?: string; className?: string; placeholder?: string; maxLength?: number;
  v: Record<string, string>; setV: (k: string, v: string) => void; err?: Record<string, string>;
}) {
  const msg = err?.[id];
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} value={v[id] ?? ""} onChange={(e) => setV(id, e.target.value)} placeholder={placeholder} maxLength={maxLength}
        aria-invalid={!!msg} className={msg ? "border-destructive focus-visible:ring-destructive" : undefined} />
      {msg && <p className="text-xs text-destructive">{msg}</p>}
    </div>
  );
}

function CheckboxRow({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string; }) {
  return (
    <label className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <span>{label}</span>
    </label>
  );
}

const BIZ_LABEL: Record<BizType, string> = {
  physical_shop: "Boutique physique",
  mobile_independent: "Indépendant à domicile",
  hybrid_business: "Boutique + interventions",
  multi_location_network: "Réseau multi-établissements",
};

function ReviewPanel({ bizType, values, wantsPartner, wantsSubc, wantsMaint, submitting, onBack, onConfirm }: {
  bizType: BizType; values: Record<string, string>;
  wantsPartner: boolean; wantsSubc: boolean; wantsMaint: boolean; submitting: boolean;
  onBack: () => void; onConfirm: () => void;
}) {
  const rows: Array<[string, string | undefined]> = [
    ["Type d'activité", BIZ_LABEL[bizType]],
    ["Contact", `${values.contact_first_name} ${values.contact_last_name} — ${values.contact_email} — ${values.contact_phone}`],
    ["Nom", values.commercial_name],
    ["Raison sociale", values.legal_name || undefined],
    ["Forme juridique", values.legal_form || undefined],
    ["SIREN / SIRET", [values.siren, values.siret].filter(Boolean).join(" / ") || undefined],
    ["Adresse", [values.address, values.postal_code, values.city].filter(Boolean).join(", ") || undefined],
    ["Site internet", values.website || undefined],
  ];
  if (bizType === "mobile_independent" || bizType === "hybrid_business") {
    rows.push(["Villes couvertes", values.covered_cities || undefined]);
    rows.push(["Codes postaux", values.covered_postal_codes || undefined]);
    rows.push(["Rayon (km)", values.service_radius_km || undefined]);
    rows.push(["Frais de déplacement", values.travel_fee_policy || undefined]);
    rows.push(["Assureur", values.insurance_provider || undefined]);
    rows.push(["N° contrat", values.insurance_policy_number || undefined]);
  }
  if (bizType === "multi_location_network") {
    rows.push(["Établissements", values.establishments_count]);
    rows.push(["Salariés", values.employees_count || undefined]);
  }
  if (bizType === "physical_shop" || bizType === "hybrid_business") {
    rows.push(["Salariés", values.employees_count || undefined]);
  }
  if (bizType === "mobile_independent") {
    rows.push(["Utilisateurs BPEI", values.users_count || undefined]);
    rows.push(["Années d'expérience", values.professional_experience_years || undefined]);
  }
  rows.push(["Services principaux", values.main_services || undefined]);
  rows.push(["Description", values.description || undefined]);
  rows.push(["Message", values.message || undefined]);
  if (bizType === "mobile_independent" || bizType === "hybrid_business") {
    const wishes: string[] = [];
    if (wantsPartner) wishes.push("Mise en relation");
    if (wantsSubc) wishes.push("Sous-traitance");
    if (wantsMaint) wishes.push("Contrats de maintenance");
    if (wishes.length) rows.push(["Partenariats souhaités", wishes.join(", ")]);
  }
  return (
    <div className="space-y-6">
      <div className="rounded-md border border-electric/30 bg-electric/5 p-3 text-sm">
        Vérifiez vos informations avant l'envoi. Vous pourrez revenir en arrière pour les modifier.
      </div>
      <dl className="divide-y divide-border rounded-lg border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-3 px-4 py-2.5 text-sm">
            <dt className="col-span-1 text-muted-foreground">{k}</dt>
            <dd className="col-span-2 whitespace-pre-wrap break-words">{v && v.trim() ? v : <span className="text-muted-foreground/60">—</span>}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>Retour au formulaire</Button>
        <Button type="button" size="lg" className="bg-electric text-electric-foreground hover:bg-electric/90" onClick={onConfirm} disabled={submitting}>
          {submitting ? "Envoi…" : "Confirmer et envoyer"}
        </Button>
      </div>
    </div>
  );
}