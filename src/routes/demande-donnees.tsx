import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitPrivacyRequest } from "@/lib/legal.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/demande-donnees")({
  head: () => ({
    meta: [
      { title: "Exercer mes droits (RGPD) — BPEI" },
      { name: "description", content: "Demander l'accès, la rectification, l'effacement ou la portabilité de vos données personnelles." },
      { property: "og:title", content: "Exercer mes droits RGPD — BPEI" },
      { property: "og:description", content: "Formulaire de demande relative à vos données personnelles." },
    ],
  }),
  component: PrivacyRequestPage,
});

const TYPES = [
  { v: "access", l: "Accès à mes données" },
  { v: "rectification", l: "Rectification" },
  { v: "deletion", l: "Effacement" },
  { v: "opposition", l: "Opposition" },
  { v: "limitation", l: "Limitation du traitement" },
  { v: "portability", l: "Portabilité" },
  { v: "other", l: "Autre" },
];

function PrivacyRequestPage() {
  const fn = useServerFn(submitPrivacyRequest);
  const [done, setDone] = useState<{ request_number: string; due_date: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const res = await fn({
        data: {
          request_type: fd.get("request_type") as any,
          requester_full_name: String(fd.get("name")),
          requester_email: String(fd.get("email")),
          description: (fd.get("description") as string) || undefined,
        },
      });
      setDone(res as any);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-4 py-12 md:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Exercer mes droits sur mes données</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Conformément au règlement général sur la protection des données, vous pouvez demander
          à consulter, corriger, supprimer ou récupérer vos données. Nous répondons dans un délai
          maximum d'un mois.
        </p>
        {done ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
            <div className="font-semibold">Demande enregistrée</div>
            <p className="mt-2 text-sm">Numéro : <span className="font-mono">{done.request_number}</span></p>
            <p className="mt-1 text-sm">Réponse attendue avant le {new Date(done.due_date).toLocaleDateString("fr-FR")}.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Type de demande *</span>
              <select name="request_type" required className="input">
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Nom complet *</span>
              <input name="name" required maxLength={200} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Email *</span>
              <input name="email" type="email" required maxLength={255} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Précisions</span>
              <textarea name="description" rows={5} maxLength={3000} className="input" />
            </label>
            <p className="text-xs text-muted-foreground">
              Une vérification d'identité pourra vous être demandée avant traitement.
            </p>
            <button disabled={loading} className="rounded-md bg-electric px-5 py-2.5 text-sm font-medium text-electric-foreground hover:bg-electric/90 disabled:opacity-60">
              {loading ? "Envoi…" : "Envoyer ma demande"}
            </button>
          </form>
        )}
      </div>
      <style>{`.input{width:100%;border:1px solid hsl(var(--border));background:hsl(var(--background));border-radius:.5rem;padding:.5rem .75rem;font-size:.875rem}`}</style>
    </PublicShell>
  );
}