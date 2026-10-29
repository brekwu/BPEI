import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/signaler-bug")({
  head: () => ({
    meta: [
      { title: "Signaler un bug ou une idée — BPEI" },
      { name: "description", content: "Aidez-nous à améliorer BPEI : signalez un bug, proposez une idée ou remontez un souci d'ergonomie." },
      { property: "og:title", content: "Signaler un bug — BPEI" },
      { property: "og:description", content: "Signalez un bug, une idée ou un souci d'ergonomie sur BPEI." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: Page,
});

const CATEGORIES = [
  { v: "bug", l: "Bug / anomalie" },
  { v: "idea", l: "Idée / suggestion" },
  { v: "ux", l: "Ergonomie / clarté" },
  { v: "performance", l: "Lenteur / performance" },
  { v: "other", l: "Autre" },
] as const;

const SEVERITIES = [
  { v: "low", l: "Faible — gênant mais contournable" },
  { v: "medium", l: "Moyen — bloque un usage courant" },
  { v: "high", l: "Élevé — bloque une fonction clé" },
  { v: "critical", l: "Critique — perte de données / sécurité" },
] as const;

function Page() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    category: "bug" as (typeof CATEGORIES)[number]["v"],
    severity: "medium" as (typeof SEVERITIES)[number]["v"],
    title: "",
    description: "",
    reporter_name: "",
    reporter_email: "",
    page_url: "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.title.trim().length < 3 || form.description.trim().length < 5) {
      toast.error("Titre et description sont trop courts.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        submitted_by: u.user?.id ?? null,
        category: form.category,
        severity: form.severity,
        title: form.title.trim(),
        description: form.description.trim(),
        reporter_name: form.reporter_name.trim() || null,
        reporter_email: form.reporter_email.trim() || null,
        page_url: form.page_url.trim() || (typeof window !== "undefined" ? window.location.href : null),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      };
      const { error } = await supabase.from("bug_reports").insert(payload);
      if (error) throw error;
      setDone(true);
      toast.success("Merci ! Votre signalement a bien été enregistré.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-navy md:text-4xl">Signaler un bug ou proposer une idée</h1>
          <p className="mt-3 text-muted-foreground">
            BPEI est en phase bêta. Chaque signalement nous aide à améliorer la plateforme.
            Pour une demande commerciale, utilisez plutôt le <Link to="/contact" className="underline">formulaire de contact</Link>.
          </p>
        </div>

        {done ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="text-lg font-semibold text-navy">Merci pour votre retour !</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Notre équipe examinera ce signalement dans les meilleurs délais.
              </p>
              <div className="mt-6 flex justify-center gap-2">
                <Button variant="outline" onClick={() => { setDone(false); setForm((f) => ({ ...f, title: "", description: "" })); }}>
                  Envoyer un autre signalement
                </Button>
                <Button asChild><Link to="/">Retour à l'accueil</Link></Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Votre signalement</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="category">Type</Label>
                    <select
                      id="category"
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.category}
                      onChange={(e) => update("category", e.target.value as typeof form.category)}
                    >
                      {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="severity">Sévérité</Label>
                    <select
                      id="severity"
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.severity}
                      onChange={(e) => update("severity", e.target.value as typeof form.severity)}
                    >
                      {SEVERITIES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="title">Titre * <span className="text-xs text-muted-foreground">(3–200 caractères)</span></Label>
                  <Input id="title" value={form.title} maxLength={200} onChange={(e) => update("title", e.target.value)} placeholder="Résumé court du problème" required />
                </div>

                <div>
                  <Label htmlFor="description">Description * <span className="text-xs text-muted-foreground">(étapes, résultat attendu, résultat obtenu)</span></Label>
                  <Textarea id="description" value={form.description} maxLength={5000} rows={7} onChange={(e) => update("description", e.target.value)} required />
                </div>

                <div>
                  <Label htmlFor="page_url">Page concernée</Label>
                  <Input id="page_url" value={form.page_url} onChange={(e) => update("page_url", e.target.value)} placeholder="URL de la page où le problème est apparu" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="reporter_name">Votre nom (facultatif)</Label>
                    <Input id="reporter_name" value={form.reporter_name} onChange={(e) => update("reporter_name", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="reporter_email">E-mail (facultatif, pour vous recontacter)</Label>
                    <Input id="reporter_email" type="email" value={form.reporter_email} onChange={(e) => update("reporter_email", e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-muted-foreground">Les informations techniques (URL, navigateur) sont transmises pour faciliter le diagnostic.</p>
                  <Button type="submit" disabled={submitting}>{submitting ? "Envoi…" : "Envoyer le signalement"}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </PublicShell>
  );
}