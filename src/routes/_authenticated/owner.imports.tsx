import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listBpeiInbox,
  setBpeiAssistance,
  getPilotBetaOverview,
  setPilotAccess,
  suspendImportJob,
  searchShopsForPilot,
  setAiImportEnabledForEnv,
} from "@/lib/imports.functions";

import { PageContainer, PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Inbox, UserCheck, CheckCircle2, PlayCircle, Beaker, Ban, Search, Plus, Minus } from "lucide-react";


export const Route = createFileRoute("/_authenticated/owner/imports")({
  head: () => ({
    meta: [
      { title: "Assistance imports · Console patron" },
      { name: "description", content: "Boîte de réception BPEI pour l'assistance sur les imports intelligents." },
    ],
  }),
  component: OwnerImportsInbox,
});

function statusBadge(s: string) {
  const map: Record<string, string> = {
    requested: "bg-amber-100 text-amber-800",
    in_progress: "bg-blue-100 text-blue-800",
    resolved: "bg-emerald-100 text-emerald-800",
  };
  return <Badge className={map[s] ?? ""}>{s}</Badge>;
}

function OwnerImportsInbox() {
  const [filter, setFilter] = useState<"all" | "requested" | "in_progress" | "resolved">("all");
  const qc = useQueryClient();
  const inboxFn = useServerFn(listBpeiInbox);
  const setFn = useServerFn(setBpeiAssistance);

  const { data, isLoading } = useQuery({
    queryKey: ["bpei-imports-inbox", filter],
    queryFn: () => (inboxFn as (args: { data: { status: typeof filter } }) => Promise<{ jobs: Array<{ id: string; shop_id: string; shop_name: string; title: string | null; kind: string; status: string; bpei_assistance_status: string; bpei_assistance_requested_at: string | null; bpei_assignee_user_id: string | null }> }>)({ data: { status: filter } }),
  });

  const mut = useMutation({
    mutationFn: (v: { jobId: string; status?: "none" | "requested" | "in_progress" | "resolved"; assignSelf?: boolean; unassign?: boolean; internalNotes?: string }) =>
      (setFn as (args: { data: typeof v }) => Promise<{ ok: boolean }>)({ data: v }),
    onSuccess: () => {
      toast.success("Mis à jour");
      qc.invalidateQueries({ queryKey: ["bpei-imports-inbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const jobs = data?.jobs ?? [];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Assistance BPEI"
        title="Imports intelligents"
        description="Prendre en charge et suivre les demandes d'assistance des boutiques sur leurs imports."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "requested", "in_progress", "resolved"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Toutes" : f}
          </Button>
        ))}
      </div>

      <BetaPilotPanel />


      <SectionCard title={`Demandes (${jobs.length})`}>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="Aucune demande en cours"
            description="Les demandes des boutiques apparaîtront ici."
          />
        ) : (
          <ul className="divide-y divide-border">
            {jobs.map((j) => (
              <li key={j.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{j.title || "Import"}</span>
                      {statusBadge(j.bpei_assistance_status)}
                      <Badge variant="outline">{j.kind}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Boutique : <span className="font-mono">{j.shop_name}</span>
                      {j.bpei_assistance_requested_at && (
                        <> · Demandée le {new Date(j.bpei_assistance_requested_at).toLocaleString("fr-FR")}</>
                      )}
                      {j.bpei_assignee_user_id && <> · Assignée</>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline"
                      onClick={() => mut.mutate({ jobId: j.id, assignSelf: true, status: "in_progress" })}>
                      <UserCheck className="mr-1 h-4 w-4" /> Prendre en charge
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => mut.mutate({ jobId: j.id, status: "in_progress" })}>
                      <PlayCircle className="mr-1 h-4 w-4" /> En cours
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => mut.mutate({ jobId: j.id, status: "resolved" })}>
                      <CheckCircle2 className="mr-1 h-4 w-4" /> Résoudre
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to="/app/shop/$shopId/imports/$jobId" params={{ shopId: j.shop_id, jobId: j.id }}>
                        Ouvrir
                      </Link>
                    </Button>
                  </div>
                </div>
                <BpeiNotesEditor jobId={j.id} onSave={(notes) => mut.mutate({ jobId: j.id, internalNotes: notes })} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}

function BpeiNotesEditor({ jobId, onSave }: { jobId: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="mt-2 flex items-end gap-2">
      <Textarea
        placeholder="Notes internes BPEI (non visibles par la boutique)"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        rows={2}
        className="text-sm"
      />
      <Button size="sm" variant="secondary" disabled={!val.trim()}
        onClick={() => { onSave(val); setVal(""); }}>
        Enregistrer
      </Button>
      <span className="sr-only">Job {jobId}</span>
    </div>
  );
}

type PilotShop = { id: string; name: string | null; ai_import_pilot_access: boolean; ai_import_pilot_granted_at?: string | null };
type PilotJob = {
  id: string; shop_id: string; title: string | null; kind: string; status: string; error: string | null;
  created_at: string; completed_at: string | null;
  metric_file_format: string | null; metric_file_bytes: number | null;
  metric_rows_total: number | null; metric_rows_recognized: number | null;
  metric_rows_errors: number | null; metric_rows_duplicates: number | null;
  metric_rows_manual_fixes: number | null;
  metric_parse_ms: number | null; metric_ai_ms: number | null; metric_generation_ms: number | null;
  metric_ai_cost_cents: number | null;
  metric_final_outcome: string | null;
};
type PilotOverview = {
  canToggleGlobalFlag: boolean;
  globalEnabled: boolean;
  runtimeEnvironment: "preview" | "production" | null;
  environments: {
    preview: { enabled: boolean };
    production: { enabled: boolean };
  };
  pilotShops: PilotShop[];
  recentJobs: PilotJob[];
  feedback: Array<{ id: string; shop_id: string; job_id: string; rating_ease: number | null; rating_recognition: number | null; time_saved_minutes: number | null; comment: string | null; allow_contact: boolean; created_at: string }>;
  totals: { total: number; success: number; partial: number; failed: number; suspended: number; inProgress: number; rowsTotal: number; rowsRecognized: number; aiCostCents: number };
  avgDurationMs: number;
  frequentErrors: Array<{ message: string; count: number }>;
};


function BetaPilotPanel() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getPilotBetaOverview);
  const setFlagFn = useServerFn(setAiImportEnabledForEnv);
  const setPilotFn = useServerFn(setPilotAccess);
  const suspendFn = useServerFn(suspendImportJob);
  const searchFn = useServerFn(searchShopsForPilot);

  const { data, isLoading } = useQuery({
    queryKey: ["pilot-beta-overview"],
    queryFn: () => (overviewFn as () => Promise<PilotOverview>)(),
  });

  const flagMut = useMutation({
    mutationFn: (v: { environment: "preview" | "production"; enabled: boolean }) =>
      (setFlagFn as (a: { data: typeof v }) => Promise<unknown>)({ data: v }),
    onSuccess: () => { toast.success("Statut d'environnement mis à jour"); qc.invalidateQueries({ queryKey: ["pilot-beta-overview"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pilotMut = useMutation({
    mutationFn: (v: { shopId: string; enabled: boolean }) => (setPilotFn as (a: { data: typeof v }) => Promise<{ ok: boolean }>)({ data: v }),
    onSuccess: () => { toast.success("Liste blanche mise à jour"); qc.invalidateQueries({ queryKey: ["pilot-beta-overview"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const suspendMut = useMutation({
    mutationFn: (v: { jobId: string; reason?: string }) => (suspendFn as (a: { data: typeof v }) => Promise<{ ok: boolean }>)({ data: v }),
    onSuccess: () => { toast.success("Import suspendu"); qc.invalidateQueries({ queryKey: ["pilot-beta-overview"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [q, setQ] = useState("");
  const searchQuery = useQuery({
    queryKey: ["pilot-shop-search", q],
    queryFn: () => (searchFn as (a: { data: { q: string } }) => Promise<{ shops: PilotShop[] }>)({ data: { q } }),
    enabled: q.trim().length >= 2,
  });

  const stats = data?.totals;
  const fmtMs = (ms: number) => ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
  const fmtBytes = (b: number | null) => !b ? "—" : b < 1024 ? `${b} o` : b < 1_048_576 ? `${(b / 1024).toFixed(1)} Ko` : `${(b / 1_048_576).toFixed(1)} Mo`;

  const pilotIds = useMemo(() => new Set((data?.pilotShops ?? []).map((s) => s.id)), [data]);

  return (
    <SectionCard
      title={<span className="inline-flex items-center gap-2"><Beaker className="h-4 w-4" /> Bêta — Import intelligent</span>}
      description="Pilotage restreint : liste blanche de boutiques, mesures et retours."
    >
      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="space-y-6">
          {/* Statut global + KPIs */}
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border p-3 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">Activation par environnement</div>
                {data.runtimeEnvironment && (
                  <Badge variant="outline" className="uppercase">
                    Actuel : {data.runtimeEnvironment}
                  </Badge>
                )}
              </div>
              <div className="mt-2 space-y-2">
                {(["preview", "production"] as const).map((env) => (
                  <div key={env} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={data.environments[env].enabled ? "default" : "outline"} className="uppercase">
                        {env}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {data.environments[env].enabled ? "Activé" : "Désactivé"}
                      </span>
                    </div>
                    {data.canToggleGlobalFlag ? (
                      <Switch
                        checked={data.environments[env].enabled}
                        onCheckedChange={(v) => {
                          if (env === "production" && v) {
                            if (!confirm("Activer le module en PRODUCTION ? Confirmez.")) return;
                          }
                          flagMut.mutate({ environment: env, enabled: v });
                        }}
                        aria-label={`Activation ${env}`}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">Owner requis</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Boutiques pilotes</div>
              <div className="mt-1 text-lg font-semibold">{data.pilotShops.length}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Imports (réussis / partiels / échoués)</div>
              <div className="mt-1 text-lg font-semibold">
                {stats?.success ?? 0} / {stats?.partial ?? 0} / {stats?.failed ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">En cours : {stats?.inProgress ?? 0} · Suspendus : {stats?.suspended ?? 0}</p>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Volumétrie</div>
              <div className="mt-1 text-lg font-semibold">{stats?.rowsRecognized ?? 0} / {stats?.rowsTotal ?? 0}</div>
              <p className="text-xs text-muted-foreground">Durée moy. : {fmtMs(data.avgDurationMs)} · IA estimée : {((stats?.aiCostCents ?? 0) / 100).toFixed(2)} €</p>
            </div>
          </div>

          {/* Ajout / retrait de boutiques pilotes */}
          <div>
            <h4 className="mb-2 text-sm font-medium">Liste blanche des boutiques pilotes</h4>
            <div className="mb-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une boutique par nom…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            {q.trim().length >= 2 && (
              <ul className="mb-3 divide-y rounded-md border">
                {(searchQuery.data?.shops ?? []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                    <span className="truncate">{s.name || s.id}</span>
                    {pilotIds.has(s.id) || s.ai_import_pilot_access ? (
                      <Button size="sm" variant="outline" onClick={() => pilotMut.mutate({ shopId: s.id, enabled: false })}>
                        <Minus className="mr-1 h-4 w-4" /> Retirer
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => pilotMut.mutate({ shopId: s.id, enabled: true })}>
                        <Plus className="mr-1 h-4 w-4" /> Ajouter
                      </Button>
                    )}
                  </li>
                ))}
                {(searchQuery.data?.shops ?? []).length === 0 && !searchQuery.isFetching && (
                  <li className="p-2 text-xs text-muted-foreground">Aucune boutique trouvée.</li>
                )}
              </ul>
            )}
            {data.pilotShops.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucune boutique pilote pour l'instant.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {data.pilotShops.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.name || s.id}</div>
                      {s.ai_import_pilot_granted_at && (
                        <div className="text-xs text-muted-foreground">
                          Depuis {new Date(s.ai_import_pilot_granted_at).toLocaleDateString("fr-FR")}
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => pilotMut.mutate({ shopId: s.id, enabled: false })}>
                      <Minus className="mr-1 h-4 w-4" /> Retirer
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Imports récents + suspension */}
          <div>
            <h4 className="mb-2 text-sm font-medium">Imports récents (50)</h4>
            {data.recentJobs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun import.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left">Import</th>
                      <th className="p-2 text-left">Format</th>
                      <th className="p-2 text-left">Lignes</th>
                      <th className="p-2 text-left">Durées</th>
                      <th className="p-2 text-left">Résultat</th>
                      <th className="p-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentJobs.map((j) => {
                      const totalMs = (j.metric_parse_ms ?? 0) + (j.metric_ai_ms ?? 0) + (j.metric_generation_ms ?? 0);
                      const active = !j.metric_final_outcome && !["done", "failed", "cancelled", "suspended"].includes(j.status);
                      return (
                        <tr key={j.id} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">{j.title || "Import"}</div>
                            <div className="text-muted-foreground">{new Date(j.created_at).toLocaleString("fr-FR")}</div>
                          </td>
                          <td className="p-2">{j.metric_file_format ?? "—"} · {fmtBytes(j.metric_file_bytes)}</td>
                          <td className="p-2">
                            {j.metric_rows_recognized ?? 0}/{j.metric_rows_total ?? 0}
                            <div className="text-muted-foreground">
                              err {j.metric_rows_errors ?? 0} · dup {j.metric_rows_duplicates ?? 0}
                            </div>
                          </td>
                          <td className="p-2">{totalMs ? fmtMs(totalMs) : "—"}</td>
                          <td className="p-2">
                            <Badge variant="outline">{j.metric_final_outcome ?? j.status}</Badge>
                          </td>
                          <td className="p-2 text-right">
                            <div className="inline-flex gap-1">
                              <Button size="sm" variant="ghost" asChild>
                                <Link to="/app/shop/$shopId/imports/$jobId" params={{ shopId: j.shop_id, jobId: j.id }}>
                                  Ouvrir
                                </Link>
                              </Button>
                              {active && (
                                <Button size="sm" variant="outline"
                                  onClick={() => suspendMut.mutate({ jobId: j.id, reason: "Suspension owner_bpei" })}>
                                  <Ban className="mr-1 h-4 w-4" /> Suspendre
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Erreurs fréquentes */}
          {data.frequentErrors.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Erreurs fréquentes</h4>
              <ul className="space-y-1 text-xs">
                {data.frequentErrors.map((e) => (
                  <li key={e.message} className="flex items-center justify-between gap-2 rounded border p-2">
                    <span className="truncate">{e.message}</span>
                    <Badge variant="outline">{e.count}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Feedback */}
          {data.feedback.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Retours boutiques ({data.feedback.length})</h4>
              <ul className="space-y-2 text-xs">
                {data.feedback.slice(0, 20).map((f) => (
                  <li key={f.id} className="rounded border p-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Facilité : {f.rating_ease ?? "—"}/5</Badge>
                      <Badge variant="outline">Reconnaissance : {f.rating_recognition ?? "—"}/5</Badge>
                      {f.time_saved_minutes != null && <Badge variant="outline">{f.time_saved_minutes} min gagnées</Badge>}
                      {f.allow_contact && <Badge>Contact autorisé</Badge>}
                    </div>
                    {f.comment && <p className="mt-1 text-muted-foreground">{f.comment}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}