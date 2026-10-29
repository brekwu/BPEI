import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitContentReport } from "@/lib/legal.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/signalement")({
  head: () => ({
    meta: [
      { title: "Signaler un contenu — BPEI" },
      { name: "description", content: "Formulaire de signalement conforme au règlement européen sur les services numériques." },
      { property: "og:title", content: "Signaler un contenu — BPEI" },
      { property: "og:description", content: "Signalez un problème relatif au réseau BPEI ou à un contenu publié." },
    ],
  }),
  component: ReportPage,
});

const CATEGORIES = [
  { v: "illegal_content", l: "Contenu illicite" },
  { v: "counterfeit", l: "Contrefaçon / atteinte à la propriété intellectuelle" },
  { v: "fraud", l: "Fraude / arnaque" },
  { v: "harassment", l: "Harcèlement / discrimination / haine" },
  { v: "minor_protection", l: "Atteinte à la protection des mineurs" },
  { v: "false_review", l: "Avis faux ou trompeur" },
  { v: "personal_data", l: "Atteinte à la vie privée / données personnelles" },
  { v: "other", l: "Autre motif" },
];

function ReportPage() {
  const fn = useServerFn(submitContentReport);
  const [submitted, setSubmitted] = useState<{ report_number: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fn({
        data: {
          category: String(fd.get("category")),
          target_type: (fd.get("target_type") as string) || undefined,
          target_id: (fd.get("target_id") as string) || undefined,
          target_url: (fd.get("target_url") as string) || undefined,
          description: String(fd.get("description")),
          legal_basis: (fd.get("legal_basis") as string) || undefined,
          reporter_name: (fd.get("reporter_name") as string) || undefined,
          reporter_email: (fd.get("reporter_email") as string) || undefined,
          reporter_phone: (fd.get("reporter_phone") as string) || undefined,
          good_faith_declared: fd.get("good_faith") === "on",
        },
      });
      setSubmitted(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'envoi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Signaler un problème ou un contenu</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ce formulaire respecte les exigences du règlement européen sur les services numériques
          (mécanisme de notification). Les signalements de mauvaise foi peuvent engager la
          responsabilité de leur auteur.
        </p>
        {submitted ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
            <div className="font-semibold">Signalement enregistré</div>
            <p className="mt-2 text-sm">
              Numéro de dossier : <span className="font-mono">{submitted.report_number}</span>
            </p>
            <p className="mt-1 text-sm">
              Notre équipe examinera votre signalement et vous répondra à l'adresse indiquée.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-6">
            <Field label="Catégorie *">
              <select name="category" required className="input">
                {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type de cible"><input name="target_type" placeholder="profil, page, contenu…" className="input" /></Field>
              <Field label="Identifiant / URL"><input name="target_url" placeholder="https://…" className="input" /></Field>
            </div>
            <Field label="Description précise *">
              <textarea name="description" required minLength={10} maxLength={5000} rows={6} className="input" placeholder="Décrivez le contenu signalé et pourquoi vous estimez qu'il enfreint les règles ou la loi." />
            </Field>
            <Field label="Base légale ou règle enfreinte (facultatif)">
              <input name="legal_basis" maxLength={500} className="input" placeholder="Article de loi, règle BPEI…" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Votre nom"><input name="reporter_name" className="input" /></Field>
              <Field label="Email *"><input name="reporter_email" type="email" required className="input" /></Field>
              <Field label="Téléphone"><input name="reporter_phone" className="input" /></Field>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="good_faith" required className="mt-1" />
              <span>Je déclare de bonne foi que les informations sont exactes et complètes.</span>
            </label>
            <button disabled={loading} className="rounded-md bg-electric px-5 py-2.5 text-sm font-medium text-electric-foreground hover:bg-electric/90 disabled:opacity-60">
              {loading ? "Envoi…" : "Envoyer le signalement"}
            </button>
          </form>
        )}
      </div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}`}</style>
    </PublicShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}