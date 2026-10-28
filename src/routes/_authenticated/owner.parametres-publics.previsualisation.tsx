import { createFileRoute } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Eye, Monitor, Tablet, Smartphone, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PreviewSettingsProvider, mergeWithDefaults, type OwnerPlatformSettingsPayload } from "@/lib/platform-settings";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/_authenticated/owner/parametres-publics/previsualisation")({
  head: () => ({
    meta: [
      { title: "Prévisualisation privée — BPEI" },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: PreviewPage,
});

type PagePreset = {
  key: string;
  label: string;
  render: (s: ReturnType<typeof mergeWithDefaults>) => ReactElement;
};

const PAGES: PagePreset[] = [
  { key: "header", label: "Header", render: () => <SiteHeader /> },
  { key: "footer", label: "Footer", render: () => <SiteFooter /> },
  {
    key: "contact",
    label: "Contact",
    render: (s) => (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Contact</h1>
        <div>Email : <b>{s.contact.email}</b></div>
        <div>Support : <b>{s.contact.support_email}</b></div>
        <div>Réclamations : <b>{s.contact.complaint_email}</b></div>
        <div>Téléphone : <b>{s.contact.phone ?? "—"}</b></div>
        <div>Adresse : <b>{s.contact.address ?? "—"}</b></div>
      </div>
    ),
  },
  {
    key: "reclamations",
    label: "Réclamations",
    render: (s) => (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Réclamations</h1>
        <div>E-mail réclamations : <b>{s.contact.complaint_email}</b></div>
        <h2 className="text-lg font-medium mt-4">Médiateur</h2>
        <div>Nom : <b>{s.mediator.name ?? "—"}</b></div>
        <div>Site : <b>{s.mediator.website ?? "—"}</b></div>
        <div>Adresse : <b>{s.mediator.address ?? "—"}</b></div>
        <div>Périmètre : <b>{s.mediator.scope ?? "—"}</b></div>
      </div>
    ),
  },
  {
    key: "mentions-legales",
    label: "Mentions légales (identité)",
    render: (s) => (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Mentions légales — Identité</h1>
        <div>Éditeur : <b>{s.identity.legal_name}</b> ({s.identity.commercial_name})</div>
        <div>Forme juridique : <b>{s.identity.legal_form ?? "—"}</b></div>
        <div>SIREN : <b>{s.identity.siren ?? "—"}</b> · RCS : <b>{s.identity.rcs ?? "—"}</b></div>
        <div>TVA : <b>{s.identity.vat ?? "—"}</b></div>
        <div>Directeur de la publication : <b>{s.identity.publication_director ?? "—"}</b></div>
        <div>Hébergeur : <b>{s.hosting.host_name ?? "—"}</b> — {s.hosting.host_address ?? "—"}</div>
      </div>
    ),
  },
  { key: "confidentialite", label: "Confidentialité", render: (s) => <TextualDocument title="Politique de confidentialité" contact={s.contact.legal_email} /> },
  { key: "cgu", label: "CGU", render: (s) => <TextualDocument title="Conditions générales d'utilisation" contact={s.contact.legal_email} /> },
  { key: "cookies", label: "Cookies", render: (s) => <TextualDocument title="Politique cookies" contact={s.contact.legal_email} /> },
  {
    key: "seo",
    label: "SEO racine",
    render: (s) => (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">SEO racine (aperçu)</h1>
        <div>Title : <b>{s.seo.default_title ?? `${s.identity.commercial_name} — ${s.identity.tagline ?? ""}`.trim()}</b></div>
        <div>Description : <b>{s.seo.default_description ?? "—"}</b></div>
      </div>
    ),
  },
];

function TextualDocument({ title, contact }: { title: string; contact: string | null }) {
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        Aperçu neutre — le contenu réel est rendu par le résolveur juridique.
        Contact indiqué en pied de page : <b>{contact ?? "—"}</b>.
      </p>
    </div>
  );
}

const VIEWPORTS = {
  desktop: { w: 1280, icon: Monitor, label: "Ordinateur" },
  tablet: { w: 768, icon: Tablet, label: "Tablette" },
  mobile: { w: 390, icon: Smartphone, label: "Mobile" },
} as const;

function PreviewPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["owner-platform-settings-preview"],
    queryFn: async (): Promise<OwnerPlatformSettingsPayload> => {
      const { data, error } = await supabase.rpc("owner_get_platform_settings");
      if (error) throw error;
      return data as unknown as OwnerPlatformSettingsPayload;
    },
  });

  const [page, setPage] = useState<string>("header");
  const [device, setDevice] = useState<keyof typeof VIEWPORTS>("desktop");
  const preset = useMemo(() => PAGES.find((p) => p.key === page) ?? PAGES[0], [page]);

  // Ensure we don't taint the public query cache on unmount.
  useEffect(() => {
    return () => {
      // draft override lives only in the provider tree — nothing to clean.
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
      </div>
    );
  }
  if (error || !data) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTitle>Accès refusé</AlertTitle>
        <AlertDescription>Seuls les owner_bpei peuvent accéder à la prévisualisation privée.</AlertDescription>
      </Alert>
    );
  }

  const draft = data.draft ?? {};
  const resolved = mergeWithDefaults(draft);

  return (
    <div className="space-y-4">
      <Alert>
        <Eye className="h-4 w-4" />
        <AlertTitle>Mode prévisualisation — ces modifications ne sont pas publiées</AlertTitle>
        <AlertDescription>
          Vous voyez les valeurs du <b>brouillon</b>. Aucune modification n'est appliquée au site public,
          aux e-mails ou au cache. Version publiée actuelle : v{data.published_version}.
        </AlertDescription>
      </Alert>

      <Card className="p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/owner/parametres-publics"><ArrowLeft className="h-4 w-4 mr-1" /> Retour</Link>
          </Button>
          <Select value={page} onValueChange={setPage}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAGES.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]).map((k) => {
            const Icon = VIEWPORTS[k].icon;
            return (
              <Button key={k} size="sm" variant={device === k ? "default" : "outline"} onClick={() => setDevice(k)}>
                <Icon className="h-4 w-4 mr-1" /> {VIEWPORTS[k].label}
              </Button>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-center">
        <div
          className="border rounded-lg bg-background overflow-auto shadow-sm"
          style={{ width: VIEWPORTS[device].w, maxWidth: "100%", minHeight: 600 }}
        >
          <PreviewSettingsProvider draft={draft}>
            {preset.render(resolved)}
          </PreviewSettingsProvider>
        </div>
      </div>
    </div>
  );
}