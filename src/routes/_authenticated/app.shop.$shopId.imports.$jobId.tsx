import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { useShop } from "@/components/shop/ShopLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  getImportJob, finalizeImportFile, parseImportFile, deleteImportFile,
  listImportRows, updateImportRow, setImportRowStatus,
  runAiAnalysis, applyAiSuggestion,
  requestBpeiAssistance,
  generateEntitiesFromJob, confirmImportValidation,
} from "@/lib/imports.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageContainer, PageHeader, SectionCard, EmptyState, Skeleton } from "@/components/ui-kit";
import { toast } from "sonner";
import { Upload, Trash2, Play, Check, X, AlertTriangle, FileSpreadsheet, Pencil, Sparkles, Wand2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/imports/$jobId")({
  head: () => ({ meta: [{ title: "Import intelligent — Révision" }] }),
  component: ImportDetailPage,
});

type EntityKind = "products" | "stock" | "services";
const ENTITY_OPTIONS: { value: EntityKind; label: string }[] = [
  { value: "products", label: "Produits" },
  { value: "services", label: "Services" },
  { value: "stock", label: "Stock" },
];

async function computeRowsDigest(jobId: string, rowIds: string[]): Promise<string> {
  const payload = `${jobId}:${[...rowIds].sort().join(",")}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ImportDetailPage() {
  const { shopId } = useShop();
  const { jobId } = Route.useParams();
  const qc = useQueryClient();

  const getFn = useServerFn(getImportJob);
  const finalizeFn = useServerFn(finalizeImportFile);
  const parseFn = useServerFn(parseImportFile);
  const delFileFn = useServerFn(deleteImportFile);
  const listRowsFn = useServerFn(listImportRows);
  const updateRowFn = useServerFn(updateImportRow);
  const setStatusFn = useServerFn(setImportRowStatus);
  const aiFn = useServerFn(runAiAnalysis);
  const applyFn = useServerFn(applyAiSuggestion);
  const askBpeiFn = useServerFn(requestBpeiAssistance);
  const generateFn = useServerFn(generateEntitiesFromJob);
  const confirmFn = useServerFn(confirmImportValidation);

  const jobQ = useQuery({
    queryKey: ["import-job", jobId],
    queryFn: () => getFn({ data: { jobId } }),
  });
  const rowsQ = useQuery({
    queryKey: ["import-rows", jobId],
    queryFn: () => listRowsFn({ data: { jobId, limit: 500 } }),
  });

  const [entityKind, setEntityKind] = useState<EntityKind>("products");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} dépasse 50 Mo — ignoré`);
          continue;
        }
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${shopId}/${jobId}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("imports-sources")
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) { toast.error(`${file.name} : ${upErr.message}`); continue; }
        await finalizeFn({ data: {
          jobId, storagePath: path,
          originalName: file.name, mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }});
      }
      toast.success("Fichier(s) envoyé(s)");
      qc.invalidateQueries({ queryKey: ["import-job", jobId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi échoué");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const parseMut = useMutation({
    mutationFn: (fileId: string) => parseFn({ data: { fileId, entityKind } }),
    onSuccess: (r) => {
      toast.success(`${r.rows} ligne(s) analysée(s) — ${r.duplicates} doublon(s), ${r.errors} erreur(s)`);
      qc.invalidateQueries({ queryKey: ["import-job", jobId] });
      qc.invalidateQueries({ queryKey: ["import-rows", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delFileMut = useMutation({
    mutationFn: (fileId: string) => delFileFn({ data: { fileId } }),
    onSuccess: () => {
      toast.success("Fichier supprimé");
      qc.invalidateQueries({ queryKey: ["import-job", jobId] });
      qc.invalidateQueries({ queryKey: ["import-rows", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (v: { rowId: string; status: "pending" | "ready" | "needs_review" | "rejected" }) =>
      setStatusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import-rows", jobId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [editRow, setEditRow] = useState<{ id: string; normalized: Record<string, unknown> } | null>(null);
  const updateMut = useMutation({
    mutationFn: (v: { rowId: string; normalized: Record<string, unknown> }) =>
      updateRowFn({ data: v }),
    onSuccess: () => {
      toast.success("Ligne mise à jour");
      setEditRow(null);
      qc.invalidateQueries({ queryKey: ["import-rows", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiMut = useMutation({
    mutationFn: () => aiFn({ data: { jobId, maxRows: 100 } }),
    onSuccess: (r) => {
      if (r.analyzed === 0) toast.info("Aucune ligne à analyser (déjà annotées ou vides).");
      else toast.success(`IA : ${r.suggested}/${r.analyzed} suggestion(s) générée(s).`);
      qc.invalidateQueries({ queryKey: ["import-job", jobId] });
      qc.invalidateQueries({ queryKey: ["import-rows", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyMut = useMutation({
    mutationFn: (rowId: string) => applyFn({ data: { rowId } }),
    onSuccess: () => {
      toast.success("Suggestion IA appliquée");
      qc.invalidateQueries({ queryKey: ["import-rows", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const askBpeiMut = useMutation({
    mutationFn: () => (askBpeiFn as (a: { data: { jobId: string } }) => Promise<{ ok: boolean }>)({ data: { jobId } }),
    onSuccess: () => { toast.success("Assistance BPEI demandée"); qc.invalidateQueries({ queryKey: ["import-job", jobId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateMut = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const readyRows = (rowsQ.data ?? []).filter((r) => r.status === "ready" && !(r as { target_id?: string | null }).target_id);
      const digest = await computeRowsDigest(jobId, readyRows.map((r) => r.id));
      if (!dryRun) {
        await (confirmFn as (a: { data: { jobId: string; digest: string } }) => Promise<{ ok: boolean }>)({ data: { jobId, digest } });
      }
      return (generateFn as (a: { data: { jobId: string; dryRun: boolean; digest?: string } }) => Promise<{ created: number; skipped: number; errors: number; byKind: Record<string, { created: number; skipped: number; errors: number }> }>)({ data: { jobId, dryRun, digest } });
    },
    onSuccess: (r, dryRun) => {
      const verb = dryRun ? "Simulation" : "Génération";
      toast.success(`${verb} : ${r.created} créé(s), ${r.skipped} ignoré(s), ${r.errors} erreur(s)`);
      if (!dryRun) setConfirmChecked(false);
      qc.invalidateQueries({ queryKey: ["import-rows", jobId] });
      qc.invalidateQueries({ queryKey: ["import-job", jobId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (jobQ.isLoading) {
    return <PageContainer><Skeleton className="h-40 w-full" /></PageContainer>;
  }
  if (jobQ.error || !jobQ.data) {
    return (
      <PageContainer>
        <EmptyState icon={<AlertTriangle className="h-6 w-6" />}
          title="Import introuvable"
          description="Ce lot d'import n'existe pas ou n'est plus accessible." />
      </PageContainer>
    );
  }

  const { job, files } = jobQ.data;
  const rows = rowsQ.data ?? [];
  const byStatus = {
    pending: rows.filter((r) => r.status === "pending"),
    needs_review: rows.filter((r) => r.status === "needs_review"),
    ready: rows.filter((r) => r.status === "ready"),
    rejected: rows.filter((r) => r.status === "rejected"),
    error: rows.filter((r) => r.status === "error"),
  };

  const aiSummary = job.ai_summary as
    | { model?: string; generated_at?: string; rows_analyzed?: number; suggested?: number; categories_detected?: string[]; insights?: string[] }
    | null;
  const analysableRows = rows.filter((r) => ["pending", "needs_review", "error"].includes(r.status) && !r.suggested).length;

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Import intelligent"
        title={job.title || "Import"}
        description={`Statut : ${job.status} — ${rows.length} ligne(s) chargée(s)`}
        actions={
          <Button
            variant="secondary"
            disabled={aiMut.isPending || analysableRows === 0}
            onClick={() => aiMut.mutate()}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {aiMut.isPending ? "Analyse en cours…" : `Analyser avec l'IA${analysableRows ? ` (${analysableRows})` : ""}`}
          </Button>
        }
      />

      {aiSummary && (
        <SectionCard title="Résumé de l'analyse IA" className="mb-6">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div><span className="text-muted-foreground">Lignes analysées :</span> <span className="font-medium">{aiSummary.rows_analyzed ?? 0}</span></div>
            <div><span className="text-muted-foreground">Suggestions :</span> <span className="font-medium">{aiSummary.suggested ?? 0}</span></div>
            <div className="truncate"><span className="text-muted-foreground">Modèle :</span> <span className="font-mono text-xs">{aiSummary.model ?? "—"}</span></div>
          </div>
          {aiSummary.categories_detected && aiSummary.categories_detected.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs uppercase text-muted-foreground">Catégories détectées</div>
              <div className="flex flex-wrap gap-1">
                {aiSummary.categories_detected.slice(0, 20).map((c) => (
                  <Badge key={c} variant="outline">{c}</Badge>
                ))}
              </div>
            </div>
          )}
          {aiSummary.insights && aiSummary.insights.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {aiSummary.insights.slice(0, 8).map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          )}
        </SectionCard>
      )}

      <SectionCard title="Assistance BPEI" className="mb-6">
        {(() => {
          const st = (job as { bpei_assistance_status?: string }).bpei_assistance_status ?? "none";
          const reqAt = (job as { bpei_assistance_requested_at?: string | null }).bpei_assistance_requested_at;
          const labels: Record<string, string> = {
            none: "Aucune demande en cours",
            requested: "Demande envoyée à l'équipe BPEI",
            in_progress: "Prise en charge par un agent BPEI",
            resolved: "Résolue par l'équipe BPEI",
          };
          return (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-medium">{labels[st] ?? st}</div>
                {reqAt && <div className="text-xs text-muted-foreground">Demandée le {new Date(reqAt).toLocaleString("fr-FR")}</div>}
              </div>
              <Button
                size="sm"
                variant={st === "none" || st === "resolved" ? "default" : "outline"}
                disabled={askBpeiMut.isPending || st === "requested" || st === "in_progress"}
                onClick={() => askBpeiMut.mutate()}
              >
                {st === "requested" || st === "in_progress" ? "Demande active" : "Demander l'aide BPEI"}
              </Button>
            </div>
          );
        })()}
      </SectionCard>

      <SectionCard title="Génération des entités" className="mb-6">
        {(() => {
          const readyRows = rows.filter((r) => r.status === "ready" && !(r as { target_id?: string | null }).target_id);
          const readyToImport = readyRows.length;
          const imported = rows.filter((r) => r.status === "imported").length;
          const byKindReady = readyRows.reduce<Record<string, number>>((acc, r) => {
            const k = (r as { entity_kind?: string }).entity_kind ?? "?";
            acc[k] = (acc[k] ?? 0) + 1; return acc;
          }, {});
          const kindLabel: Record<string, string> = { products: "produits", services: "services", stock: "articles de stock" };
          const summary = Object.entries(byKindReady)
            .map(([k, n]) => `${n} ${kindLabel[k] ?? k}`).join(" · ");
          const validatedAt = (job as { validated_at?: string | null }).validated_at;
          return (
            <div className="space-y-4">
              <div>
                <div className="font-medium text-sm">
                  {readyToImport} ligne(s) prête(s) à générer{imported > 0 ? ` — ${imported} déjà créée(s)` : ""}
                </div>
                {summary && <div className="text-xs text-muted-foreground">Répartition : {summary}</div>}
                <div className="mt-1 text-xs text-muted-foreground">
                  Crée les produits, services et articles de stock réels dans la boutique à partir des lignes validées.
                  <br />
                  Périmètre actuel : <strong>produits, services, stock</strong>. Autres formats (images, PDF, site web, profil boutique) — <em>prochainement</em>.
                </div>
              </div>

              <label className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  disabled={readyToImport === 0}
                />
                <span>
                  Je confirme, en tant que responsable de la boutique, que les {readyToImport} ligne(s) sélectionnée(s)
                  peuvent être écrites dans mon catalogue. Cette validation est signée avec mon compte et enregistrée à
                  des fins d'audit. BPEI ne peut jamais valider à ma place.
                  {validatedAt && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Dernière validation : {new Date(validatedAt).toLocaleString("fr-FR")}
                    </span>
                  )}
                </span>
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={generateMut.isPending || readyToImport === 0}
                  onClick={() => generateMut.mutate(true)}
                >
                  Simuler
                </Button>
                <Button
                  size="sm"
                  disabled={generateMut.isPending || readyToImport === 0 || !confirmChecked}
                  onClick={() => generateMut.mutate(false)}
                >
                  <Wand2 className="mr-2 h-4 w-4" />
                  {generateMut.isPending ? "Génération…" : `Générer (${readyToImport})`}
                </Button>
              </div>
            </div>
          );
        })()}
      </SectionCard>






      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard title="Fichiers source">
          {files.length === 0 ? (
            <EmptyState
              icon={<FileSpreadsheet className="h-6 w-6" />}
              title="Aucun fichier"
              description="Envoyez un CSV ou XLSX pour lancer l'analyse."
            />
          ) : (
            <ul className="divide-y divide-border">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{f.original_name}</span>
                      <Badge variant="outline">{f.kind}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(f.size_bytes / 1024).toFixed(1)} Ko
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary"
                      onClick={() => parseMut.mutate(f.id)}
                      disabled={parseMut.isPending || (f.kind !== "csv" && f.kind !== "xlsx")}
                    >
                      <Play className="mr-1 h-3.5 w-3.5" /> Analyser
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => { if (confirm("Supprimer ce fichier ?")) delFileMut.mutate(f.id); }}
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Envoyer un fichier">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type de contenu</Label>
              <Select value={entityKind} onValueChange={(v) => setEntityKind(v as EntityKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENTITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Utilisé lors de l'analyse pour deviner les colonnes.
              </p>
            </div>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              multiple
              disabled={uploading}
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button className="w-full" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Envoi…" : "Choisir un fichier"}
            </Button>
            <p className="text-xs text-muted-foreground">
              CSV ou XLSX jusqu'à 50 Mo. Aucun import réel n'est effectué : cette étape prépare
              uniquement les données pour votre relecture.
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard title={`Lignes analysées (${rows.length})`} className="mt-6">
        {rows.length === 0 ? (
          <EmptyState icon={<FileSpreadsheet className="h-6 w-6" />}
            title="Aucune ligne à réviser"
            description="Analysez un fichier pour voir les lignes normalisées apparaître ici." />
        ) : (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">Toutes ({rows.length})</TabsTrigger>
              <TabsTrigger value="pending">À valider ({byStatus.pending.length})</TabsTrigger>
              <TabsTrigger value="needs_review">Doublons ({byStatus.needs_review.length})</TabsTrigger>
              <TabsTrigger value="error">Erreurs ({byStatus.error.length})</TabsTrigger>
              <TabsTrigger value="ready">Validées ({byStatus.ready.length})</TabsTrigger>
              <TabsTrigger value="rejected">Rejetées ({byStatus.rejected.length})</TabsTrigger>
            </TabsList>
            {(["all", "pending", "needs_review", "error", "ready", "rejected"] as const).map((tab) => {
              const list = tab === "all" ? rows : rows.filter((r) => r.status === tab);
              return (
                <TabsContent key={tab} value={tab} className="mt-4">
                  <RowsTable
                    rows={list}
                    onEdit={(r) => setEditRow({ id: r.id, normalized: (r.normalized as Record<string, unknown>) ?? {} })}
                    onAccept={(id) => statusMut.mutate({ rowId: id, status: "ready" })}
                    onReject={(id) => statusMut.mutate({ rowId: id, status: "rejected" })}
                    onReopen={(id) => statusMut.mutate({ rowId: id, status: "pending" })}
                    onApplyAi={(id) => applyMut.mutate(id)}
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </SectionCard>

      <BetaFeedbackCard jobId={jobId} jobStatus={(job as { status?: string } | null)?.status ?? ""} />



      <div className="mt-6 text-center text-sm">
        <Link to="/app/shop/$shopId/imports" params={{ shopId }} className="underline text-muted-foreground hover:text-foreground">
          ← Retour à la liste des imports
        </Link>
      </div>

      <EditRowDialog
        open={!!editRow}
        row={editRow}
        onClose={() => setEditRow(null)}
        onSave={(normalized) => editRow && updateMut.mutate({ rowId: editRow.id, normalized })}
        saving={updateMut.isPending}
      />
    </PageContainer>
  );
}

type Row = {
  id: string; entity_kind: string; source_index: number | null;
  raw: unknown; normalized: unknown; suggested?: unknown; status: string;
  duplicate_of: string | null; errors: unknown;
};

function RowsTable({ rows, onEdit, onAccept, onReject, onReopen, onApplyAi }: {
  rows: Row[];
  onEdit: (r: Row) => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onReopen: (id: string) => void;
  onApplyAi: (id: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Rien dans cette catégorie.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Statut</th>
            <th className="py-2 pr-2">Aperçu normalisé</th>
            <th className="py-2 pr-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const n = (r.normalized as Record<string, unknown>) ?? {};
            const errList = (r.errors as { list?: string[] } | null)?.list ?? [];
            const sugg = r.suggested as { patch?: Record<string, unknown>; notes?: string | null } | null;
            const hasSugg = !!sugg?.patch && Object.keys(sugg.patch).length > 0;
            return (
              <tr key={r.id} className="align-top">
                <td className="py-2 pr-2 text-muted-foreground">{r.source_index ?? "—"}</td>
                <td className="py-2 pr-2"><StatusBadge status={r.status} isDup={!!r.duplicate_of} /></td>
                <td className="py-2 pr-2">
                  <div className="text-foreground">
                    {(n.name as string) || (n.email as string) || (n.company_name as string) || (n.last_name as string) || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">
                    {Object.entries(n)
                      .filter(([k]) => !["name"].includes(k))
                      .slice(0, 5)
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" • ")}
                  </div>
                  {errList.length > 0 && (
                    <div className="mt-1 text-xs text-destructive">{errList.join(" · ")}</div>
                  )}
                  {hasSugg && (
                    <div className="mt-1 rounded border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-900">
                      <div className="flex items-center gap-1 font-medium">
                        <Sparkles className="h-3 w-3" /> Suggestion IA
                      </div>
                      <div className="mt-0.5 line-clamp-2">
                        {Object.entries(sugg!.patch!).map(([k, v]) => `${k} → ${String(v)}`).join(" · ")}
                      </div>
                      {sugg?.notes && <div className="mt-0.5 italic opacity-80">{sugg.notes}</div>}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    {hasSugg && (
                      <Button size="sm" variant="ghost" onClick={() => onApplyAi(r.id)} aria-label="Appliquer la suggestion IA" title="Appliquer la suggestion IA">
                        <Wand2 className="h-4 w-4 text-violet-600" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onEdit(r)} aria-label="Éditer">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {r.status !== "ready" && (
                      <Button size="sm" variant="ghost" onClick={() => onAccept(r.id)} aria-label="Valider">
                        <Check className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                    {r.status !== "rejected" && (
                      <Button size="sm" variant="ghost" onClick={() => onReject(r.id)} aria-label="Rejeter">
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                    {(r.status === "ready" || r.status === "rejected") && (
                      <Button size="sm" variant="ghost" onClick={() => onReopen(r.id)}>
                        Rouvrir
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
  );
}

function StatusBadge({ status, isDup }: { status: string; isDup: boolean }) {
  const map: Record<string, { label: string; variant?: "default" | "secondary" | "outline" | "destructive" }> = {
    pending: { label: "À valider", variant: "outline" },
    needs_review: { label: "Doublon possible", variant: "secondary" },
    ready: { label: "Validée", variant: "default" },
    rejected: { label: "Rejetée", variant: "destructive" },
    error: { label: "Erreur", variant: "destructive" },
    imported: { label: "Importée", variant: "default" },
  };
  const info = map[status] ?? { label: status };
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={info.variant}>{info.label}</Badge>
      {isDup && status !== "needs_review" && <Badge variant="outline">doublon</Badge>}
    </div>
  );
}

function EditRowDialog({ open, row, onClose, onSave, saving }: {
  open: boolean;
  row: { id: string; normalized: Record<string, unknown> } | null;
  onClose: () => void;
  onSave: (normalized: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const keys = row ? Object.keys(row.normalized) : [];
  // Reset draft when row changes
  const rowId = row?.id ?? "";
  const lastRowRef = useRef<string>("");
  if (rowId !== lastRowRef.current) {
    lastRowRef.current = rowId;
    if (row) {
      const initial: Record<string, string> = {};
      for (const k of Object.keys(row.normalized)) initial[k] = String(row.normalized[k] ?? "");
      setDraft(initial);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Éditer la ligne</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {keys.map((k) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">{k}</Label>
              <Input value={draft[k] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
            </div>
          ))}
          {keys.length === 0 && <p className="text-sm text-muted-foreground">Aucun champ normalisé.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            disabled={saving}
            onClick={() => {
              const out: Record<string, unknown> = {};
              for (const k of keys) {
                const v = draft[k];
                if (v === "" || v == null) continue;
                if (k.endsWith("_cents") || ["tax_rate", "quantity", "min_threshold", "estimated_duration_minutes"].includes(k)) {
                  const n = Number(v.replace(",", "."));
                  out[k] = Number.isFinite(n) ? n : v;
                } else out[k] = v;
              }
              onSave(out);
            }}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Feedback bêta (facultatif) ---
import { submitImportFeedback, getMyImportFeedback } from "@/lib/imports.functions";
import { Textarea } from "@/components/ui/textarea";

function BetaFeedbackCard({ jobId, jobStatus }: { jobId: string; jobStatus: string }) {
  const submitFn = useServerFn(submitImportFeedback);
  const readFn = useServerFn(getMyImportFeedback);
  const qc = useQueryClient();
  const showable = ["done", "completed", "failed", "cancelled", "suspended"].includes(jobStatus);

  const { data: existing } = useQuery({
    queryKey: ["import-feedback", jobId],
    queryFn: () => (readFn as (a: { data: { jobId: string } }) => Promise<{ feedback: { rating_ease: number | null; rating_recognition: number | null; comment: string | null } | null }>)({ data: { jobId } }),
    enabled: showable,
  });

  const [ratingEase, setRatingEase] = useState<number>(0);
  const [ratingReco, setRatingReco] = useState<number>(0);
  const [timeSaved, setTimeSaved] = useState<string>("");
  const [poorlyRecognized, setPoorlyRecognized] = useState("");
  const [missingFeature, setMissingFeature] = useState("");
  const [comment, setComment] = useState("");
  const [allowContact, setAllowContact] = useState(false);

  const mut = useMutation({
    mutationFn: () => (submitFn as (a: { data: {
      jobId: string; ratingEase?: number; ratingRecognition?: number; timeSavedMinutes?: number;
      poorlyRecognized?: string; missingFeature?: string; comment?: string; allowContact: boolean;
    } }) => Promise<{ ok: boolean }>)({ data: {
      jobId,
      ratingEase: ratingEase || undefined,
      ratingRecognition: ratingReco || undefined,
      timeSavedMinutes: timeSaved ? Number(timeSaved) : undefined,
      poorlyRecognized: poorlyRecognized.trim() || undefined,
      missingFeature: missingFeature.trim() || undefined,
      comment: comment.trim() || undefined,
      allowContact,
    } }),
    onSuccess: () => { toast.success("Merci pour votre retour"); qc.invalidateQueries({ queryKey: ["import-feedback", jobId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!showable) return null;

  if (existing?.feedback) {
    return (
      <SectionCard title="Votre retour bêta" description="Enregistré, merci !">
        <div className="text-sm text-muted-foreground">
          Facilité {existing.feedback.rating_ease ?? "—"}/5 · Reconnaissance {existing.feedback.rating_recognition ?? "—"}/5
          {existing.feedback.comment && <p className="mt-2 text-foreground">{existing.feedback.comment}</p>}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Retour bêta (facultatif)" description="Aidez-nous à améliorer l'Import intelligent BPEI.">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
        <div>
          <Label>Facilité d'utilisation</Label>
          <div className="mt-1 flex gap-1">
            {[1,2,3,4,5].map((n) => (
              <Button key={n} type="button" size="sm" variant={ratingEase === n ? "default" : "outline"} onClick={() => setRatingEase(n)}>{n}</Button>
            ))}
          </div>
        </div>
        <div>
          <Label>Qualité de reconnaissance</Label>
          <div className="mt-1 flex gap-1">
            {[1,2,3,4,5].map((n) => (
              <Button key={n} type="button" size="sm" variant={ratingReco === n ? "default" : "outline"} onClick={() => setRatingReco(n)}>{n}</Button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="fb-time">Temps gagné estimé (minutes)</Label>
          <Input id="fb-time" type="number" min={0} value={timeSaved} onChange={(e) => setTimeSaved(e.target.value)} />
        </div>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" checked={allowContact} onChange={(e) => setAllowContact(e.target.checked)} />
          J'autorise BPEI à me recontacter pour approfondir mon retour.
        </label>
        <div className="md:col-span-2">
          <Label htmlFor="fb-poor">Informations mal reconnues (facultatif)</Label>
          <Textarea id="fb-poor" rows={2} value={poorlyRecognized} onChange={(e) => setPoorlyRecognized(e.target.value)} maxLength={2000} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="fb-missing">Fonctionnalité manquante (facultatif)</Label>
          <Textarea id="fb-missing" rows={2} value={missingFeature} onChange={(e) => setMissingFeature(e.target.value)} maxLength={2000} />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="fb-comment">Commentaire libre</Label>
          <Textarea id="fb-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={4000} />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "Envoi…" : "Envoyer mon retour"}</Button>
        </div>
      </form>
    </SectionCard>
  );
}