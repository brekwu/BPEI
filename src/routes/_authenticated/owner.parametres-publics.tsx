import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { runPublicationProbes, retrySingleConsumer } from "@/lib/platform-probes.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type {
  OwnerPlatformSettingsPayload,
  PlatformPublicSettings,
  PlatformSettingsPublication,
} from "@/lib/platform-settings";
import { Loader2, Save, Send, RotateCcw, History, Eye, GitCompare, Activity, RefreshCcw, CheckCircle2, AlertTriangle } from "lucide-react";


export const Route = createFileRoute("/_authenticated/owner/parametres-publics")({
  head: () => ({ meta: [{ title: "Paramètres publics — BPEI" }] }),
  component: Page,
});

type Draft = PlatformPublicSettings;

const EMPTY: Draft = {
  identity: {}, contact: {}, hosting: {}, mediator: {}, social: {}, seo: {}, beta: {},
};

function fieldChanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}
function diffFields(draft: Draft, published: Draft): string[] {
  const groups: (keyof Draft)[] = ["identity","contact","hosting","mediator","social","seo","beta"];
  const changed: string[] = [];
  for (const g of groups) {
    const d = (draft[g] ?? {}) as Record<string, unknown>;
    const p = (published[g] ?? {}) as Record<string, unknown>;
    const keys = new Set([...Object.keys(d), ...Object.keys(p)]);
    for (const k of keys) if (fieldChanged(d[k], p[k])) changed.push(`${g}.${k}`);
  }
  return changed;
}

function Page() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["owner-platform-settings"],
    queryFn: async (): Promise<OwnerPlatformSettingsPayload> => {
      const { data, error } = await supabase.rpc("owner_get_platform_settings");
      if (error) throw error;
      return data as unknown as OwnerPlatformSettingsPayload;
    },
  });

  const [draft, setDraft] = useState<Draft>(EMPTY);
  useEffect(() => {
    if (data) setDraft({ ...EMPTY, ...(data.draft ?? {}) });
  }, [data]);

  const changed = useMemo(() => diffFields(draft, data?.published ?? EMPTY), [draft, data]);
  const isDirty = data ? JSON.stringify(draft) !== JSON.stringify(data.draft ?? {}) : false;

  const saveDraft = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("owner_save_platform_settings_draft", { p_draft: draft as never });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Brouillon enregistré"); qc.invalidateQueries({ queryKey: ["owner-platform-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runProbes = useServerFn(runPublicationProbes);

  const publish = useMutation({
    mutationFn: async (note: string | null) => {
      // Ensure the latest edits are persisted as draft before publishing.
      if (isDirty) {
        const { error: sErr } = await supabase.rpc("owner_save_platform_settings_draft", { p_draft: draft as never });
        if (sErr) throw sErr;
      }
      const { data: pub, error } = await supabase.rpc("owner_publish_platform_settings", {
        p_changed_fields: changed,
        p_note: note ?? undefined,
      });
      if (error) throw error;
      const publication_id = (pub as any)?.publication_id as string | undefined;
      const version = (pub as any)?.version as number | undefined;
      if (publication_id && version) {
        await supabase.rpc("owner_seed_publication_consumers", { p_publication_id: publication_id });
        try {
          await runProbes({ data: { publication_id, expected_version: version } });
        } catch (e) {
          // Ne bloque pas la publication : les sondes seront relançables manuellement.
          console.warn("Probes post-publication en échec", e);
        }
      }
      return pub;
    },
    onSuccess: () => {
      toast.success("Paramètres publiés — sondes déclenchées");
      qc.invalidateQueries({ queryKey: ["owner-platform-settings"] });
      qc.invalidateQueries({ queryKey: ["platform-public-settings"] });
      qc.invalidateQueries({ queryKey: ["publication-consumers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async ({ publicationId, reason }: { publicationId: string; reason: string }) => {
      const { data: r, error } = await supabase.rpc("owner_rollback_platform_settings_with_reason", {
        p_publication_id: publicationId,
        p_reason: reason,
      });
      if (error) throw error;
      const new_pub_id = (r as any)?.publication_id as string | undefined;
      const new_version = (r as any)?.version as number | undefined;
      if (new_pub_id && new_version) {
        try {
          await runProbes({ data: { publication_id: new_pub_id, expected_version: new_version } });
        } catch (e) {
          console.warn("Probes post-rollback en échec", e);
        }
      }
    },
    onSuccess: () => {
      toast.success("Version restaurée et publiée");
      qc.invalidateQueries({ queryKey: ["owner-platform-settings"] });
      qc.invalidateQueries({ queryKey: ["platform-public-settings"] });
      qc.invalidateQueries({ queryKey: ["publication-consumers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  if (isLoading || !data) {
    return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>;
  }

  function updateGroup<G extends keyof Draft>(group: G, patch: Draft[G]) {
    setDraft((d) => ({ ...d, [group]: { ...(d[group] ?? {}), ...patch } }));
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Paramètres publics du site</h1>
          <p className="text-sm text-muted-foreground">
            Source unique de vérité — publiée à l'intégralité du site public au clic sur « Publier ».
          </p>
          <div className="mt-1 text-xs text-muted-foreground">
            Version publiée : <b>v{data.published_version}</b>
            {data.published_at && <> · Publiée le {new Date(data.published_at).toLocaleString("fr-FR")}</>}
            {" · "}
            {changed.length > 0
              ? <Badge variant="destructive">{changed.length} champ(s) modifié(s)</Badge>
              : <Badge variant="secondary">Aucune modification en attente</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/owner/parametres-publics/previsualisation"><Eye className="h-4 w-4 mr-1" />Aperçu privé</Link>
          </Button>
          <Button variant="outline" onClick={() => setDraft({ ...EMPTY, ...(data.draft ?? {}) })} disabled={!isDirty}>
            Annuler les modifications
          </Button>
          <Button variant="secondary" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending || !isDirty}>
            <Save className="h-4 w-4 mr-1" /> Enregistrer le brouillon
          </Button>
          <Button
            onClick={() => {
              if (changed.length === 0 && !isDirty) { toast.info("Aucun changement à publier"); return; }
              const note = window.prompt("Note de publication (optionnel) :") ?? null;
              publish.mutate(note);
            }}
            disabled={publish.isPending}
          >
            <Send className="h-4 w-4 mr-1" /> Publier
          </Button>
        </div>
      </Card>


      <Tabs defaultValue="identity">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="identity">Identité</TabsTrigger>
          <TabsTrigger value="contact">Coordonnées</TabsTrigger>
          <TabsTrigger value="hosting">Hébergement</TabsTrigger>
          <TabsTrigger value="mediator">Médiateur</TabsTrigger>
          <TabsTrigger value="social">Réseaux</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="compare"><GitCompare className="h-3.5 w-3.5 mr-1" />Comparer</TabsTrigger>
          <TabsTrigger value="propagation"><Activity className="h-3.5 w-3.5 mr-1" />Propagation</TabsTrigger>
          <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1" />Historique</TabsTrigger>
        </TabsList>


        <TabsContent value="identity">
          <Card className="p-4 grid gap-3 md:grid-cols-2">
            <Field label="Nom commercial" value={draft.identity?.commercial_name ?? ""} onChange={(v) => updateGroup("identity", { commercial_name: v })} />
            <Field label="Dénomination légale" value={draft.identity?.legal_name ?? ""} onChange={(v) => updateGroup("identity", { legal_name: v })} />
            <Field label="Forme juridique" value={draft.identity?.legal_form ?? ""} onChange={(v) => updateGroup("identity", { legal_form: v })} />
            <Field label="SIREN" value={draft.identity?.siren ?? ""} onChange={(v) => updateGroup("identity", { siren: v })} />
            <Field label="RCS" value={draft.identity?.rcs ?? ""} onChange={(v) => updateGroup("identity", { rcs: v })} />
            <Field label="TVA intracommunautaire" value={draft.identity?.vat ?? ""} onChange={(v) => updateGroup("identity", { vat: v })} />
            <Field label="Directeur de la publication" value={draft.identity?.publication_director ?? ""} onChange={(v) => updateGroup("identity", { publication_director: v })} />
            <Field label="Slogan / tagline" value={draft.identity?.tagline ?? ""} onChange={(v) => updateGroup("identity", { tagline: v })} />
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card className="p-4 grid gap-3 md:grid-cols-2">
            <Field label="E-mail principal" value={draft.contact?.email ?? ""} onChange={(v) => updateGroup("contact", { email: v })} />
            <Field label="E-mail support" value={draft.contact?.support_email ?? ""} onChange={(v) => updateGroup("contact", { support_email: v })} />
            <Field label="E-mail juridique" value={draft.contact?.legal_email ?? ""} onChange={(v) => updateGroup("contact", { legal_email: v })} />
            <Field label="E-mail réclamations" value={draft.contact?.complaint_email ?? ""} onChange={(v) => updateGroup("contact", { complaint_email: v })} />
            <Field label="Téléphone" value={draft.contact?.phone ?? ""} onChange={(v) => updateGroup("contact", { phone: v })} />
            <Field label="Adresse postale" value={draft.contact?.address ?? ""} onChange={(v) => updateGroup("contact", { address: v })} span2 />
          </Card>
        </TabsContent>

        <TabsContent value="hosting">
          <Card className="p-4 grid gap-3 md:grid-cols-2">
            <Field label="Hébergeur" value={draft.hosting?.host_name ?? ""} onChange={(v) => updateGroup("hosting", { host_name: v })} />
            <Field label="Adresse hébergeur" value={draft.hosting?.host_address ?? ""} onChange={(v) => updateGroup("hosting", { host_address: v })} />
          </Card>
        </TabsContent>

        <TabsContent value="mediator">
          <Card className="p-4 grid gap-3 md:grid-cols-2">
            <Field label="Nom du médiateur" value={draft.mediator?.name ?? ""} onChange={(v) => updateGroup("mediator", { name: v })} />
            <Field label="Site web" value={draft.mediator?.website ?? ""} onChange={(v) => updateGroup("mediator", { website: v })} />
            <Field label="Adresse" value={draft.mediator?.address ?? ""} onChange={(v) => updateGroup("mediator", { address: v })} span2 />
            <Field label="Périmètre" value={draft.mediator?.scope ?? ""} onChange={(v) => updateGroup("mediator", { scope: v })} span2 />
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card className="p-4 grid gap-3 md:grid-cols-2">
            <Field label="LinkedIn" value={draft.social?.linkedin ?? ""} onChange={(v) => updateGroup("social", { linkedin: v })} />
            <Field label="X / Twitter" value={draft.social?.x ?? ""} onChange={(v) => updateGroup("social", { x: v })} />
            <Field label="Instagram" value={draft.social?.instagram ?? ""} onChange={(v) => updateGroup("social", { instagram: v })} />
            <Field label="Facebook" value={draft.social?.facebook ?? ""} onChange={(v) => updateGroup("social", { facebook: v })} />
            <Field label="YouTube" value={draft.social?.youtube ?? ""} onChange={(v) => updateGroup("social", { youtube: v })} />
            <p className="text-xs text-muted-foreground md:col-span-2">
              Les liens vides ne seront pas affichés dans le footer.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="seo">
          <Card className="p-4 grid gap-3">
            <Field label="Titre SEO par défaut" value={draft.seo?.default_title ?? ""} onChange={(v) => updateGroup("seo", { default_title: v })} />
            <div>
              <Label>Description SEO par défaut</Label>
              <Textarea
                rows={3}
                value={draft.seo?.default_description ?? ""}
                onChange={(e) => updateGroup("seo", { default_description: e.target.value })}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="compare">
          <CompareTab draft={draft} published={(data.published ?? EMPTY) as Draft} changed={changed} />
        </TabsContent>

        <TabsContent value="propagation">
          <PropagationTab publications={data.publications} />
        </TabsContent>

        <TabsContent value="history">

          <Card className="p-4">
            <h2 className="font-medium mb-3">Historique des publications</h2>
            {data.publications.length === 0
              ? <p className="text-sm text-muted-foreground">Aucune publication pour l'instant.</p>
              : (
                <ul className="divide-y">
                  {data.publications.map((p: PlatformSettingsPublication) => (
                    <li key={p.id} className="py-2 flex flex-wrap items-center gap-2">
                      <Badge variant={p.status === "rolled_back" ? "outline" : "secondary"}>v{p.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(p.published_at).toLocaleString("fr-FR")}
                      </span>
                      <span className="text-xs">{p.changed_fields.length} champ(s)</span>
                      {p.note && <span className="text-xs italic text-muted-foreground">— {p.note}</span>}
                      <span className="ml-auto">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const reason = window.prompt(`Restaurer v${p.version} ? Indiquez le motif du rollback (min. 5 caractères) :`);
                            if (!reason || reason.trim().length < 5) {
                              if (reason !== null) toast.error("Motif trop court (min. 5 caractères)");
                              return;
                            }
                            restore.mutate({ publicationId: p.id, reason: reason.trim() });
                          }}
                          disabled={restore.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurer
                        </Button>

                      </span>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, onChange, span2 }: { label: string; value: string; onChange: (v: string) => void; span2?: boolean }) {
  const id = useId();
  return (
    <div className={span2 ? "md:col-span-2" : ""}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function fieldValue(draft: Draft, path: string): unknown {
  const [g, k] = path.split(".") as [keyof Draft, string];
  return (draft[g] as Record<string, unknown> | undefined)?.[k];
}
function fmt(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  return typeof v === "string" ? v : JSON.stringify(v);
}

function CompareTab({ draft, published, changed }: { draft: Draft; published: Draft; changed: string[] }) {
  if (changed.length === 0) {
    return (
      <Card className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        Brouillon identique à la version publiée.
      </Card>
    );
  }
  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-3 bg-muted/50 text-xs font-medium px-3 py-2">
        <div>Champ</div><div>Publié</div><div>Brouillon</div>
      </div>
      <ul className="divide-y text-sm">
        {changed.map((path) => (
          <li key={path} className="grid grid-cols-3 gap-2 px-3 py-2">
            <code className="text-xs">{path}</code>
            <div className="text-muted-foreground line-through break-words">{fmt(fieldValue(published, path))}</div>
            <div className="font-medium break-words">{fmt(fieldValue(draft, path))}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

type ConsumerStatus = {
  id: string;
  publication_id: string;
  consumer_key: string;
  status: string;
  attempts: number;
  is_essential: boolean;
  last_error_message: string | null;
  last_checked_at: string | null;
  last_attempt_at: string | null;
  observed_version: number | null;
  expected_version: number;
};


const CONSUMER_LABELS: Record<string, string> = {
  header: "Header", footer: "Footer", accueil: "Accueil",
  contact: "Contact", reclamations: "Réclamations",
  mentions_legales: "Mentions légales", confidentialite: "Confidentialité",
  cgu: "CGU", cookies: "Cookies", tarifs: "Tarifs", rejoindre: "Rejoindre",
  seo_root: "SEO racine", open_graph: "Open Graph", favicon: "Favicon",
  sitemap: "Sitemap", emails: "E-mails",
};

function PropagationTab({ publications }: { publications: PlatformSettingsPublication[] }) {
  const qc = useQueryClient();
  const latest = publications[0];
  const [selectedId, setSelectedId] = useState<string | null>(latest?.id ?? null);
  useEffect(() => { if (!selectedId && latest) setSelectedId(latest.id); }, [latest, selectedId]);
  const selectedPub = publications.find((p) => p.id === selectedId) ?? null;
  const expectedVersion = selectedPub?.version ?? 0;

  const runProbes = useServerFn(runPublicationProbes);
  const retryOne = useServerFn(retrySingleConsumer);

  const { data: consumers, isLoading } = useQuery({
    queryKey: ["publication-consumers", selectedId],
    queryFn: async (): Promise<ConsumerStatus[]> => {
      if (!selectedId) return [];
      const { data, error } = await supabase
        .from("platform_settings_consumer_status")
        .select("*")
        .eq("publication_id", selectedId)
        .order("consumer_key");
      if (error) throw error;
      return (data ?? []) as ConsumerStatus[];
    },
    enabled: !!selectedId,
    refetchInterval: 5_000,
  });

  const seed = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      const { error } = await supabase.rpc("owner_seed_publication_consumers", { p_publication_id: selectedId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Consommateurs initialisés"); qc.invalidateQueries({ queryKey: ["publication-consumers", selectedId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runAll = useMutation({
    mutationFn: async () => {
      if (!selectedId || !expectedVersion) return;
      await runProbes({ data: { publication_id: selectedId, expected_version: expectedVersion } });
    },
    onSuccess: () => { toast.success("Sondes exécutées"); qc.invalidateQueries({ queryKey: ["publication-consumers", selectedId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const retry = useMutation({
    mutationFn: async (consumerKey: string) => {
      if (!selectedId || !expectedVersion) return;
      await retryOne({ data: { publication_id: selectedId, expected_version: expectedVersion, consumer_key: consumerKey } });
    },
    onSuccess: () => { toast.success("Sonde relancée"); qc.invalidateQueries({ queryKey: ["publication-consumers", selectedId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (publications.length === 0) {
    return <Card className="p-4 text-sm text-muted-foreground">Aucune publication à suivre.</Card>;
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Publication :</Label>
        <select
          className="text-sm border rounded px-2 py-1 bg-background"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {publications.map((p) => (
            <option key={p.id} value={p.id}>
              v{p.version} — {new Date(p.published_at).toLocaleString("fr-FR")}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
          Initialiser les consommateurs
        </Button>
        <Button size="sm" onClick={() => runAll.mutate()} disabled={runAll.isPending || !expectedVersion}>
          <Activity className="h-3.5 w-3.5 mr-1" /> Relancer toutes les sondes
        </Button>
        <p className="text-xs text-muted-foreground w-full">
          La propagation est <b>atomique</b> : dès la publication, chaque consommateur SSR sert la
          nouvelle version au prochain rendu. Ce tableau enregistre l'état observé et permet de
          déclencher un réessai (invalidation caches / re-rendu) sur un consommateur en échec.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : (consumers ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun consommateur suivi pour cette publication. Cliquez sur « Initialiser » pour créer les entrées.
        </p>
      ) : (
        <ul className="divide-y">
          {(consumers ?? []).map((c) => (
            <li key={c.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium min-w-[10rem]">{CONSUMER_LABELS[c.consumer_key] ?? c.consumer_key}</span>
              <StatusBadge status={c.status} />
              <span className="text-xs text-muted-foreground">tentatives : {c.attempts}</span>
              {c.last_checked_at && <span className="text-xs text-muted-foreground">observé {new Date(c.last_checked_at).toLocaleString("fr-FR")}</span>}
              {c.last_error_message && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {c.last_error_message}
                </span>
              )}

              <span className="ml-auto">
                <Button size="sm" variant="outline" onClick={() => retry.mutate(c.consumer_key)} disabled={retry.isPending}>
                  <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Réessayer
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "outline", label: "En attente" },
    propagated: { variant: "secondary", label: "Propagé" },
    observed_ok: { variant: "default", label: "OK" },
    success: { variant: "default", label: "OK" },
    failed: { variant: "destructive", label: "Échec" },
    retrying: { variant: "outline", label: "Réessai" },
    skipped: { variant: "outline", label: "Ignoré" },
    not_applicable: { variant: "secondary", label: "N/A" },
  };
  const cfg = map[status] ?? { variant: "outline" as const, label: status };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}