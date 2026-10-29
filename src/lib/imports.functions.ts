import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  resolveRuntimeEnvironment,
  describeRuntimeEnvironment,
  type RuntimeEnvironment,
} from "@/lib/imports/runtime-env.server";

/**
 * Contrôle central et serveur exclusif : environnement reconnu, drapeau actif
 * pour cet environnement, et boutique inscrite sur la liste blanche pilote de
 * ce même environnement. Aucun paramètre client n'est accepté.
 */
async function assertAiImportEnabledForRuntime(
  context: { supabase: { rpc: (n: string, p?: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message: string } | null }> } },
  shopId?: string,
): Promise<RuntimeEnvironment> {
  const env = resolveRuntimeEnvironment();
  if (!env) {
    throw new Error("Environnement d'exécution non reconnu — module désactivé.");
  }
  const { data: flag, error: fErr } = await context.supabase
    .rpc("is_ai_import_enabled_env", { _env: env });
  if (fErr) throw new Error(fErr.message);
  if (!flag) {
    throw new Error(
      env === "production"
        ? "Le module Import intelligent est désactivé en production."
        : "Le module Import intelligent est désactivé sur cet environnement.",
    );
  }
  if (shopId) {
    const { data: pilot, error: pErr } = await context.supabase
      .rpc("is_ai_import_pilot_env", { _shop_id: shopId, _env: env });
    if (pErr) throw new Error(pErr.message);
    if (!pilot) {
      throw new Error(
        "Bêta réservée aux boutiques pilotes de cet environnement. Contactez BPEI.",
      );
    }
  }
  return env;
}



/**
 * Lot 1 — Import intelligent BPEI : fondations sécurisées.
 *
 * Ces fonctions serveur exposent l'ossature CRUD sur `import_jobs` /
 * `import_files`. Toutes les vérifications de sécurité sont assurées côté DB
 * par les policies RLS (multi-tenant + feature flag `ai_import_enabled`).
 * Aucune analyse IA, aucun parsing, aucun import réel dans ce lot.
 */

const KindEnum = z.enum([
  "products", "stock", "services", "shop_profile", "mixed",
]);
const EntityEnum = z.enum(["products", "stock", "services"]);
const RowStatusEnum = z.enum(["pending", "ready", "needs_review", "rejected", "imported", "error"]);

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "text/csv", "application/csv", "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const CreateJobInput = z.object({
  shopId: z.string().uuid(),
  kind: KindEnum.default("mixed"),
  title: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const isAiImportEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const env = resolveRuntimeEnvironment();
    if (!env) return { enabled: false, environment: null as RuntimeEnvironment | null };
    const { data, error } = await context.supabase.rpc("is_ai_import_enabled_env", { _env: env });
    if (error) throw new Error(error.message);
    return { enabled: !!data, environment: env };
  });

/** Retourne l'environnement d'exécution résolu côté serveur (badge UI). */
export const getRuntimeEnvironment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => describeRuntimeEnvironment());


export const listImportJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shopId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("import_jobs")
      .select("id, shop_id, kind, status, title, notes, totals, bpei_assisted, created_at, updated_at, completed_at, error")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateJobInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAiImportEnabledForRuntime(context as never, data.shopId);

    const { data: row, error } = await context.supabase
      .from("import_jobs")
      .insert({
        shop_id: data.shopId,
        created_by: context.userId,
        kind: data.kind,
        title: data.title ?? null,
        notes: data.notes ?? null,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("import_audit_logs").insert({
      shop_id: data.shopId,
      job_id: row.id,
      actor_user_id: context.userId,
      actor_role: "shop",
      action: "job.created",
      details: { kind: data.kind, title: data.title ?? null },
    });

    return { id: row.id };
  });


export const getImportJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("import_jobs")
      .select("*")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Import introuvable");

    const [{ data: files }, { data: audit }] = await Promise.all([
      context.supabase
        .from("import_files")
        .select("id, original_name, size_bytes, mime_type, kind, scan_status, created_at")
        .eq("job_id", data.jobId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("import_audit_logs")
        .select("id, action, details, actor_role, created_at")
        .eq("job_id", data.jobId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return { job, files: files ?? [], audit: audit ?? [] };
  });

export const deleteImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error: jerr } = await context.supabase
      .from("import_jobs")
      .select("id, shop_id, status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (jerr) throw new Error(jerr.message);
    if (!job) throw new Error("Import introuvable");
    if (!["draft", "failed", "cancelled"].includes(job.status)) {
      throw new Error("Seuls les imports en brouillon, échoués ou annulés peuvent être supprimés.");
    }

    const { error } = await context.supabase.from("import_jobs").delete().eq("id", data.jobId);
    if (error) throw new Error(error.message);

    await context.supabase.from("import_audit_logs").insert({
      shop_id: job.shop_id,
      job_id: null,
      actor_user_id: context.userId,
      actor_role: "shop",
      action: "job.deleted",
      details: { job_id: data.jobId },
    });
    return { ok: true };
  });

// ---------- Lot 2 : upload, parsing, révision ----------

function guessFileKind(name: string, mime: string): "csv" | "xlsx" | "other" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv") || mime === "text/csv" || mime === "application/csv" || mime === "text/plain") return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("spreadsheet") || mime.includes("excel")) return "xlsx";
  return "other";
}

/** Enregistre un fichier déjà uploadé dans le bucket privé `imports-sources`. */
export const finalizeImportFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      jobId: z.string().uuid(),
      storagePath: z.string().min(1).max(500),
      originalName: z.string().min(1).max(300),
      mimeType: z.string().min(1).max(200),
      sizeBytes: z.number().int().min(0).max(MAX_UPLOAD_BYTES),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: job, error: jerr } = await context.supabase
      .from("import_jobs").select("id, shop_id, status").eq("id", data.jobId).maybeSingle();
    if (jerr) throw new Error(jerr.message);
    if (!job) throw new Error("Import introuvable");
    if (!data.storagePath.startsWith(`${job.shop_id}/`)) {
      throw new Error("Chemin de stockage incohérent avec la boutique.");
    }
    if (!ALLOWED_MIME.has(data.mimeType) && !/\.(csv|xlsx|xls)$/i.test(data.originalName)) {
      throw new Error("Format non supporté (CSV ou XLSX attendu).");
    }
    const kind = guessFileKind(data.originalName, data.mimeType);

    const { data: row, error } = await context.supabase.from("import_files").insert({
      job_id: data.jobId,
      shop_id: job.shop_id,
      uploaded_by: context.userId,
      storage_path: data.storagePath,
      original_name: data.originalName,
      mime_type: data.mimeType,
      size_bytes: data.sizeBytes,
      kind,
      scan_status: "clean",
    }).select("id").single();
    if (error) throw new Error(error.message);

    await context.supabase.from("import_audit_logs").insert({
      shop_id: job.shop_id, job_id: data.jobId, actor_user_id: context.userId,
      actor_role: "shop", action: "file.uploaded",
      details: { file_id: row.id, name: data.originalName, size: data.sizeBytes, kind },
    });

    if (job.status === "draft") {
      await context.supabase.from("import_jobs").update({ status: "queued" }).eq("id", data.jobId);
    }
    return { id: row.id, kind };
  });

/** Supprime un fichier source (et l'objet stockage associé). */
export const deleteImportFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ fileId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: file, error } = await context.supabase
      .from("import_files").select("id, job_id, shop_id, storage_path").eq("id", data.fileId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!file) throw new Error("Fichier introuvable");
    await context.supabase.storage.from("imports-sources").remove([file.storage_path]);
    const { error: delErr } = await context.supabase.from("import_files").delete().eq("id", data.fileId);
    if (delErr) throw new Error(delErr.message);
    await context.supabase.from("import_audit_logs").insert({
      shop_id: file.shop_id, job_id: file.job_id, actor_user_id: context.userId,
      actor_role: "shop", action: "file.deleted", details: { file_id: file.id },
    });
    return { ok: true };
  });

/** Parse un fichier source et crée les lignes normalisées prêtes pour la relecture. */
export const parseImportFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      fileId: z.string().uuid(),
      entityKind: EntityEnum.optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAiImportEnabledForRuntime(context as never);

    const { parseWorkbookBuffer, TARGET_TABLE } = await import("./imports/parse.server");

    const { data: file, error: ferr } = await context.supabase
      .from("import_files")
      .select("id, job_id, shop_id, storage_path, kind, original_name, size_bytes")
      .eq("id", data.fileId).maybeSingle();
    if (ferr) throw new Error(ferr.message);
    if (!file) throw new Error("Fichier introuvable");
    await assertAiImportEnabledForRuntime(context as never, file.shop_id);

    if (file.kind !== "csv" && file.kind !== "xlsx") {
      throw new Error("Ce type de fichier ne peut pas être parsé automatiquement dans ce lot.");
    }

    const { data: job } = await context.supabase
      .from("import_jobs").select("kind").eq("id", file.job_id).maybeSingle();

    let entityKind = data.entityKind
      ?? (job?.kind && ["products", "stock", "services"].includes(job.kind)
          ? (job.kind as "products") : undefined);
    if (!entityKind) entityKind = "products";

    await context.supabase.from("import_jobs").update({ status: "analyzing", error: null }).eq("id", file.job_id);

    const parseStartedAt = Date.now();
    try {
      const { data: blob, error: dlErr } = await context.supabase
        .storage.from("imports-sources").download(file.storage_path);
      if (dlErr || !blob) throw new Error(dlErr?.message || "Téléchargement du fichier impossible");
      const buf = await blob.arrayBuffer();

      const result = parseWorkbookBuffer(buf, entityKind);

      // Purge des lignes précédentes du fichier (re-parse idempotent)
      await context.supabase.from("import_rows").delete().eq("file_id", file.id);

      // Détection de doublons SQL en une passe par entité
      const target = TARGET_TABLE[entityKind];
      const duplicateMap = new Map<number, { id: string; label: string }>();

      if (entityKind === "stock") {
        const skus = result.rows.map((r) => r.normalized.sku as string).filter(Boolean);
        const names = result.rows.map((r) => r.normalized.name as string).filter(Boolean);
        const [bySku, byName] = await Promise.all([
          skus.length ? context.supabase.from("stock_items").select("id, sku").eq("shop_id", file.shop_id).in("sku", skus) : Promise.resolve({ data: [] as { id: string; sku: string | null }[] }),
          names.length ? context.supabase.from("stock_items").select("id, name").eq("shop_id", file.shop_id).in("name", names) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        ]);
        const skuIx = new Map<string, string>();
        (bySku.data ?? []).forEach((c) => { if (c.sku) skuIx.set(c.sku, c.id); });
        const nameIx = new Map<string, string>();
        (byName.data ?? []).forEach((c) => nameIx.set(c.name.toLowerCase(), c.id));
        result.rows.forEach((r, i) => {
          const sku = r.normalized.sku as string | undefined;
          const nm = r.normalized.name as string | undefined;
          const hit = (sku && skuIx.get(sku)) || (nm && nameIx.get(nm.toLowerCase()));
          if (hit) duplicateMap.set(i, { id: hit, label: sku || nm || "" });
        });
      } else {
        // products / services → service_catalog par nom
        const names = result.rows.map((r) => r.normalized.name as string).filter(Boolean);
        const lineType = entityKind === "services" ? "service" : "product";
        const byName = names.length
          ? await context.supabase.from("service_catalog")
              .select("id, name, line_type").eq("shop_id", file.shop_id)
              .eq("line_type", lineType).in("name", names)
          : { data: [] as { id: string; name: string }[] };
        const nameIx = new Map<string, string>();
        (byName.data ?? []).forEach((c) => nameIx.set(c.name.toLowerCase(), c.id));
        result.rows.forEach((r, i) => {
          const nm = r.normalized.name as string | undefined;
          if (nm) {
            const hit = nameIx.get(nm.toLowerCase());
            if (hit) duplicateMap.set(i, { id: hit, label: nm });
          }
        });
      }

      // Bulk insert par chunks de 200
      const CHUNK = 200;
      let inserted = 0, dup = 0, err = 0;
      for (let i = 0; i < result.rows.length; i += CHUNK) {
        const slice = result.rows.slice(i, i + CHUNK).map((r, j) => {
          const idx = i + j;
          const isDup = duplicateMap.has(idx);
          const hasErr = r.errors.length > 0;
          const status: "pending" | "needs_review" | "error" = hasErr
            ? "error"
            : isDup ? "needs_review" : "pending";
          if (isDup) dup++;
          if (hasErr) err++; else inserted++;
          return {
            job_id: file.job_id,
            shop_id: file.shop_id,
            file_id: file.id,
            entity_kind: entityKind,
            source_index: r.sourceIndex,
            raw: r.raw as never,
            normalized: r.normalized as never,
            status,
            duplicate_of: isDup ? duplicateMap.get(idx)!.id : null,
            target_table: target,
            errors: r.errors.length ? ({ list: r.errors } as never) : null,
          };
        });
        if (slice.length) {
          const { error: insErr } = await context.supabase.from("import_rows").insert(slice);
          if (insErr) throw new Error(insErr.message);
        }
      }

      await context.supabase.from("import_files").update({
        parsed_summary: {
          entity_kind: entityKind,
          headers: result.headers,
          column_map: result.columnMap,
          total_rows: result.totalRows,
          dropped_rows: result.droppedRows,
          duplicates: dup,
          errors: err,
        },
      }).eq("id", file.id);

      const parseMs = Date.now() - parseStartedAt;
      await context.supabase.from("import_jobs").update({
        status: "review",
        totals: { parsed: result.totalRows, duplicates: dup, errors: err, ready: inserted - dup },
        metric_file_format: file.kind,
        metric_file_bytes: (file as { size_bytes?: number }).size_bytes ?? null,
        metric_rows_total: result.totalRows,
        metric_rows_recognized: Math.max(0, inserted - dup),
        metric_rows_errors: err,
        metric_rows_duplicates: dup,
        metric_parse_ms: parseMs,
      }).eq("id", file.job_id);

      await context.supabase.from("import_audit_logs").insert({
        shop_id: file.shop_id, job_id: file.job_id, actor_user_id: context.userId,
        actor_role: "shop", action: "file.parsed",
        details: { file_id: file.id, entity_kind: entityKind, rows: result.totalRows, duplicates: dup, errors: err, parse_ms: parseMs },
      });

      return { ok: true, entityKind, rows: result.totalRows, duplicates: dup, errors: err };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await context.supabase.from("import_jobs").update({
        status: "failed", error: msg.slice(0, 500), metric_final_outcome: "failed",
      }).eq("id", file.job_id);
      throw e;
    }
  });


/** Liste paginée simple des lignes d'un import (par statut). */
export const listImportRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      jobId: z.string().uuid(),
      status: RowStatusEnum.optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("import_rows")
      .select("id, entity_kind, source_index, raw, normalized, suggested, status, duplicate_of, target_table, errors, created_at")
      .eq("job_id", data.jobId)
      .order("source_index", { ascending: true })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Édite la version normalisée d'une ligne (relecture manuelle). */
export const updateImportRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      rowId: z.string().uuid(),
      normalized: z.record(z.string(), z.unknown()),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("import_rows")
      .update({
        normalized: data.normalized as never,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.rowId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Change le statut d'une ligne (accepter / rejeter / marquer doublon). */
export const setImportRowStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      rowId: z.string().uuid(),
      status: z.enum(["pending", "ready", "needs_review", "rejected"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("import_rows")
      .update({
        status: data.status,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.rowId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Lot 3 : analyse IA (Lovable AI Gateway) ----------

/** Lance l'analyse IA sur les lignes en attente d'un import. */
export const runAiAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      jobId: z.string().uuid(),
      maxRows: z.number().int().min(1).max(200).default(100),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAiImportEnabledForRuntime(context as never);

    const { analyzeRowsWithAI } = await import("./imports/ai.server");

    const { data: job, error: jerr } = await context.supabase
      .from("import_jobs").select("id, shop_id, kind, status")
      .eq("id", data.jobId).maybeSingle();
    if (jerr) throw new Error(jerr.message);
    if (!job) throw new Error("Import introuvable");
    await assertAiImportEnabledForRuntime(context as never, job.shop_id);


    const { data: rows, error: rerr } = await context.supabase
      .from("import_rows")
      .select("id, entity_kind, source_index, normalized, errors, status")
      .eq("job_id", data.jobId)
      .in("status", ["pending", "needs_review", "error"])
      .is("suggested", null)
      .order("source_index", { ascending: true })
      .limit(data.maxRows);
    if (rerr) throw new Error(rerr.message);
    const aiStartedAt = Date.now();
    if (!rows || rows.length === 0) {
      return { analyzed: 0, suggested: 0, insights: 0 };
    }

    // Regroupe par entité (pour prompts spécialisés)
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = r.entity_kind;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }

    const allInsights: string[] = [];
    const allCategories: string[] = [];
    let totalSuggested = 0;

    for (const [entity, list] of groups) {
      if (!["products", "stock", "services"].includes(entity)) continue;
      const inputs = list.map((r, i) => ({
        id: r.id,
        index: r.source_index ?? i,
        normalized: (r.normalized as Record<string, unknown>) ?? {},
        errors: (r.errors as { list?: string[] } | null)?.list ?? [],
      }));
      const { suggestions, summary } = await analyzeRowsWithAI(entity as never, inputs);
      allInsights.push(...summary.insights);
      allCategories.push(...summary.categories_detected);

      for (const s of suggestions) {
        const { error: uerr } = await context.supabase.from("import_rows")
          .update({ suggested: { patch: s.suggested, notes: s.notes ?? null, confidence: s.confidence ?? null } as never })
          .eq("id", s.id).eq("job_id", data.jobId);
        if (!uerr) totalSuggested++;
      }
    }

    const summary = {
      model: "google/gemini-2.5-flash",
      generated_at: new Date().toISOString(),
      rows_analyzed: rows.length,
      suggested: totalSuggested,
      categories_detected: Array.from(new Set(allCategories)).slice(0, 40),
      insights: allInsights.slice(0, 20),
    };

    const aiMs = Date.now() - aiStartedAt;
    // Coût IA estimé (Gemini 2.5 Flash) — approximation: ~300 tokens/ligne, tarif Lovable.
    const aiCostCents = Math.max(1, Math.round(rows.length * 0.05));

    await context.supabase.from("import_jobs")
      .update({ ai_summary: summary as never, status: "review", metric_ai_ms: aiMs, metric_ai_cost_cents: aiCostCents })
      .eq("id", data.jobId);

    await context.supabase.from("import_audit_logs").insert({
      shop_id: job.shop_id, job_id: data.jobId, actor_user_id: context.userId,
      actor_role: "shop", action: "ai.analysis",
      details: { analyzed: rows.length, suggested: totalSuggested, model: summary.model },
    });

    return { analyzed: rows.length, suggested: totalSuggested, insights: summary.insights.length };
  });

/** Applique la suggestion IA sur une ligne (fusionne dans normalized). */
export const applyAiSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ rowId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("import_rows").select("id, normalized, suggested")
      .eq("id", data.rowId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Ligne introuvable");
    const suggested = row.suggested as { patch?: Record<string, unknown> } | null;
    if (!suggested?.patch) throw new Error("Aucune suggestion à appliquer");
    const merged = { ...(row.normalized as Record<string, unknown>), ...suggested.patch };
    const { error: uerr } = await context.supabase.from("import_rows")
      .update({
        normalized: merged as never,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.rowId);
    if (uerr) throw new Error(uerr.message);
    return { ok: true };
  });

// ---------- Lot 4 : assistance BPEI ----------

async function assertBpei(context: { userId: string; supabase: { rpc: (n: string, a: unknown) => { data?: unknown; error?: { message: string } | null } | Promise<{ data?: unknown; error?: { message: string } | null }> } }) {
  const [a, o] = await Promise.all([
    context.supabase.rpc("is_admin_bpei", { _user: context.userId }),
    context.supabase.rpc("is_owner_bpei", { _user: context.userId }),
  ] as never as Promise<{ data?: boolean; error?: { message: string } | null }>[]);
  const ok = Boolean(a?.data) || Boolean(o?.data);
  if (!ok) throw new Error("Accès refusé");
}

async function isBpeiUser(context: { userId: string; supabase: any }): Promise<boolean> {
  const [a, o] = await Promise.all([
    context.supabase.rpc("is_admin_bpei", { _user: context.userId }),
    context.supabase.rpc("is_owner_bpei", { _user: context.userId }),
  ]);
  return Boolean(a?.data) || Boolean(o?.data);
}


/** La boutique demande l'assistance BPEI sur un job d'import. */
export const requestBpeiAssistance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await context.supabase
      .from("import_jobs").select("id, shop_id").eq("id", data.jobId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Import introuvable");
    const { error: uerr } = await context.supabase.from("import_jobs")
      .update({
        bpei_assistance_status: "requested",
        bpei_assistance_requested_at: new Date().toISOString(),
      })
      .eq("id", data.jobId);
    if (uerr) throw new Error(uerr.message);
    await context.supabase.from("import_audit_logs").insert({
      shop_id: job.shop_id, job_id: data.jobId, actor_user_id: context.userId,
      actor_role: "shop", action: "bpei.assistance_requested", details: {},
    });
    return { ok: true };
  });

/** BPEI met à jour le statut d'assistance et/ou s'assigne le job. */
export const setBpeiAssistance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      jobId: z.string().uuid(),
      status: z.enum(["none", "requested", "in_progress", "resolved"]).optional(),
      assignSelf: z.boolean().optional(),
      unassign: z.boolean().optional(),
      internalNotes: z.string().max(4000).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertBpei(context as never);

    const patch: Record<string, unknown> = {};
    if (data.status) patch.bpei_assistance_status = data.status;
    if (data.assignSelf) patch.bpei_assignee_user_id = context.userId;
    if (data.unassign) patch.bpei_assignee_user_id = null;
    if (typeof data.internalNotes === "string") patch.bpei_notes = data.internalNotes;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { data: job, error } = await context.supabase.from("import_jobs")
      .update(patch as never).eq("id", data.jobId).select("shop_id").maybeSingle();
    if (error) throw new Error(error.message);

    if (job) {
      await context.supabase.from("import_audit_logs").insert({
        shop_id: job.shop_id, job_id: data.jobId, actor_user_id: context.userId,
        actor_role: "bpei", action: "bpei.assistance_updated", details: patch as never,
      });
    }
    return { ok: true };
  });

/** Liste les notes BPEI/boutique pour un job (visible aux membres de la boutique et à BPEI). */
export const listRowNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("import_row_notes")
      .select("id, row_id, author_role, author_user_id, note, suggested, created_at")
      .eq("job_id", data.jobId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { notes: rows ?? [] };
  });

/** Ajoute une note sur une ligne. Le rôle est déduit du profil de l'utilisateur. */
export const addRowNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      rowId: z.string().uuid(),
      note: z.string().min(1).max(4000),
      suggested: z.record(z.string(), z.unknown()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: rerr } = await context.supabase
      .from("import_rows").select("id, job_id, shop_id").eq("id", data.rowId).maybeSingle();
    if (rerr) throw new Error(rerr.message);
    if (!row) throw new Error("Ligne introuvable");

    const isBpei = await isBpeiUser(context as never);
    const authorRole = isBpei ? "bpei" : "shop";

    const { error } = await context.supabase.from("import_row_notes").insert({
      row_id: row.id, job_id: row.job_id, shop_id: row.shop_id,
      author_user_id: context.userId, author_role: authorRole,
      note: data.note, suggested: (data.suggested ?? null) as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Boîte de réception BPEI : jobs avec assistance demandée / en cours. */
export const listBpeiInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    status: z.enum(["all", "requested", "in_progress", "resolved"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertBpei(context as never);

    let q = context.supabase.from("import_jobs")
      .select("id, shop_id, title, kind, status, bpei_assistance_status, bpei_assistance_requested_at, bpei_assignee_user_id, updated_at")
      .neq("bpei_assistance_status", "none")
      .order("bpei_assistance_requested_at", { ascending: false });
    if (data.status !== "all") q = q.eq("bpei_assistance_status", data.status);
    const { data: jobs, error } = await q.limit(200);
    if (error) throw new Error(error.message);

    const shopIds = Array.from(new Set((jobs ?? []).map((j) => j.shop_id))).filter(Boolean);
    let shopMap = new Map<string, string>();
    if (shopIds.length > 0) {
      const { data: shops } = await context.supabase
        .from("shops").select("id, name").in("id", shopIds as string[]);
      shopMap = new Map((shops ?? []).map((s) => [s.id, s.name as string]));
    }
    return {
      jobs: (jobs ?? []).map((j) => ({ ...j, shop_name: shopMap.get(j.shop_id) ?? "—" })),
    };
  });

// ---------- Lot 5 : génération réelle des entités ----------

type NormRow = Record<string, unknown>;

function pickStr(o: NormRow, keys: string[], max = 500): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim().slice(0, max);
    if (typeof v === "number") return String(v);
  }
  return null;
}
function pickNum(o: NormRow, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(",", ".").replace(/[^\d.\-]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
function toCents(n: number | null): number { return n == null ? 0 : Math.max(0, Math.round(n * 100)); }

function buildProductPayload(shopId: string, n: NormRow): Record<string, unknown> | null {
  const name = pickStr(n, ["name", "nom", "libelle", "title", "designation"], 240);
  if (!name) return null;
  return {
    shop_id: shopId,
    sku: pickStr(n, ["sku", "ref", "reference", "code"], 80),
    barcode: pickStr(n, ["barcode", "ean", "gtin"], 80),
    name,
    description: pickStr(n, ["description", "desc", "details"], 4000),
    category: pickStr(n, ["category", "categorie", "famille"], 120),
    brand: pickStr(n, ["brand", "marque"], 120),
    item_type: "part",
    unit: pickStr(n, ["unit", "unite"], 30) ?? "unité",
    cost_price_cents: toCents(pickNum(n, ["cost_price", "prix_achat", "cost", "purchase_price"])),
    sell_price_cents: toCents(pickNum(n, ["sell_price", "price", "prix", "prix_vente", "unit_price"])),
    tax_rate: pickNum(n, ["tax_rate", "tva", "vat"]) ?? 20,
    quantity: pickNum(n, ["quantity", "quantite", "stock", "qty"]) ?? 0,
    min_threshold: pickNum(n, ["min_threshold", "min", "seuil"]) ?? 0,
    location: pickStr(n, ["location", "emplacement"], 120),
    supplier_ref: pickStr(n, ["supplier_ref", "fournisseur"], 120),
    active: true,
  };
}

function buildServicePayload(shopId: string, n: NormRow): Record<string, unknown> | null {
  const name = pickStr(n, ["name", "nom", "libelle", "title", "designation"], 240);
  if (!name) return null;
  return {
    shop_id: shopId,
    name,
    description: pickStr(n, ["description", "desc"], 4000),
    category: pickStr(n, ["category", "categorie"], 120),
    line_type: "service",
    internal_reference: pickStr(n, ["ref", "reference", "code"], 80),
    default_quantity: pickNum(n, ["quantity", "quantite"]) ?? 1,
    unit: pickStr(n, ["unit", "unite"], 30) ?? "unité",
    unit_price_cents: toCents(pickNum(n, ["price", "prix", "unit_price", "tarif"])),
    tax_rate: pickNum(n, ["tax_rate", "tva"]) ?? 20,
    estimated_duration_minutes: pickNum(n, ["duration_minutes", "duree", "duration"]),
    active: true,
  };
}

// (l'ancien helper `assertAiImportEnabled` a été remplacé par
// `assertAiImportEnabledForRuntime` — vérification par environnement.)


/**
 * Confirmation finale obligatoire par un responsable de la boutique.
 * BPEI (owner_bpei / admin_bpei) ne peut jamais valider à la place de la boutique
 * — la RPC `confirm_import_validation` refuse tout appel hors membre boutique.
 */
export const confirmImportValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    jobId: z.string().uuid(),
    digest: z.string().min(8).max(200),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("confirm_import_validation", {
      _job_id: data.jobId, _digest: data.digest,
    });
    if (error) throw new Error(error.message);
    const { data: j2 } = await context.supabase.from("import_jobs").select("shop_id").eq("id", data.jobId).maybeSingle();
    if (j2?.shop_id) {
      await context.supabase.from("import_audit_logs").insert({
        shop_id: j2.shop_id, job_id: data.jobId, actor_user_id: context.userId,
        actor_role: "shop", action: "job.validated",
        details: { digest: data.digest },
      });
    }
    return { ok: true };
  });

/**
 * Bascule du drapeau `ai_import_enabled` pour un environnement donné
 * (préview ou production). Réservé owner_bpei (contrôle SQL). Toute mise à
 * jour Production doit être explicite : l'appelant fournit `environment`.
 */
export const setAiImportEnabledForEnv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    environment: z.enum(["preview", "production"]),
    enabled: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: v, error } = await context.supabase.rpc("set_ai_import_enabled_env", {
      _env: data.environment, _enabled: data.enabled,
    });
    if (error) throw new Error(error.message);
    return { environment: data.environment, enabled: !!v };
  });

/** Ajout/retrait d'une boutique de la liste blanche pilote d'un environnement. */
export const grantAiImportPilotForEnv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    shopId: z.string().uuid(),
    environment: z.enum(["preview", "production"]),
    enabled: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: v, error } = await context.supabase.rpc("grant_ai_import_pilot_env", {
      _shop_id: data.shopId, _env: data.environment, _enabled: data.enabled,
    });
    if (error) throw new Error(error.message);
    return { shopId: data.shopId, environment: data.environment, enabled: !!v };
  });


/**
 * Génère (insère) les entités réelles à partir des lignes marquées "ready".
 * - Exige un flag `ai_import_enabled=true` côté serveur (au-delà de la RLS).
 * - Exige la validation finale par la boutique (`validated_by`) + digest égal
 *   au digest signé (empêche une génération sur un jeu de lignes différent).
 * - Verrou d'exécution atomique via RPC `acquire_import_generation_lock` :
 *   un second appel simultané reçoit `already_running` et n'écrit rien.
 * - Idempotence : l'index unique `(target_table, target_id)` empêche le double
 *   rattachement, et le filtre `.is("target_id", null)` empêche le retraitement.
 */
export const generateEntitiesFromJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    jobId: z.string().uuid(),
    entityKind: EntityEnum.optional(),
    maxRows: z.number().int().min(1).max(1000).default(500),
    dryRun: z.boolean().default(false),
    digest: z.string().min(8).max(200).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAiImportEnabledForRuntime(context as never);

    const { data: job, error: jerr } = await context.supabase
      .from("import_jobs").select("id, shop_id, status, validated_by, validated_at, validated_digest")
      .eq("id", data.jobId).maybeSingle();
    if (jerr) throw new Error(jerr.message);
    if (!job) throw new Error("Import introuvable");
    await assertAiImportEnabledForRuntime(context as never, job.shop_id);


    // Réservé aux exécutions réelles : validation finale obligatoire par la boutique
    if (!data.dryRun) {
      if (!job.validated_by || !job.validated_at) {
        throw new Error("Validation finale par la boutique requise avant la génération.");
      }
      if (data.digest && job.validated_digest && data.digest !== job.validated_digest) {
        throw new Error("Les lignes ont changé depuis la validation — reconfirmez avant de relancer.");
      }
    }

    // Verrou d'exécution (real run uniquement)
    const lockToken = crypto.randomUUID();
    if (!data.dryRun) {
      const { data: acquired, error: lerr } = await context.supabase.rpc(
        "acquire_import_generation_lock", { _job_id: data.jobId, _token: lockToken },
      );
      if (lerr) throw new Error(lerr.message);
      if (!acquired) throw new Error("Une génération est déjà en cours pour cet import.");
    }

    const genStartedAt = Date.now();
    try {
      let q = context.supabase.from("import_rows")
        .select("id, entity_kind, normalized")
        .eq("job_id", data.jobId)
        .eq("status", "ready")
        .is("target_id", null)
        .order("source_index", { ascending: true })
        .limit(data.maxRows);
      if (data.entityKind) q = q.eq("entity_kind", data.entityKind);
      const { data: rows, error: rerr } = await q;
      if (rerr) throw new Error(rerr.message);
      if (!rows || rows.length === 0) return { created: 0, skipped: 0, errors: 0, byKind: {} };

      const byKind: Record<string, { created: number; skipped: number; errors: number }> = {};
      let totalCreated = 0, totalSkipped = 0, totalErrors = 0;

      for (const row of rows) {
        const kind = row.entity_kind as string;
        byKind[kind] ??= { created: 0, skipped: 0, errors: 0 };
        const n = (row.normalized as NormRow) ?? {};
        let table: "stock_items" | "service_catalog" | null = null;
        let payload: Record<string, unknown> | null = null;
        if (kind === "products" || kind === "stock") { table = "stock_items"; payload = buildProductPayload(job.shop_id, n); }
        else if (kind === "services") { table = "service_catalog"; payload = buildServicePayload(job.shop_id, n); }
        // Toute autre entité (customers, shop_profile, images, pdf…) est explicitement
        // ignorée côté serveur — non prise en charge par le module à ce jour.
        if (!table || !payload) { byKind[kind].skipped++; totalSkipped++; continue; }
        if (data.dryRun) { byKind[kind].created++; totalCreated++; continue; }

        const { data: ins, error: ierr } = await (context.supabase as unknown as {
          from: (t: string) => { insert: (p: unknown) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } } }
        }).from(table).insert(payload).select("id").single();
        if (ierr || !ins) { byKind[kind].errors++; totalErrors++;
          await context.supabase.from("import_rows")
            .update({ status: "error", errors: { list: [ierr?.message ?? "insert failed"] } as never })
            .eq("id", row.id);
          continue;
        }
        await context.supabase.from("import_rows")
          .update({ status: "imported", target_table: table, target_id: ins.id, imported_at: new Date().toISOString() })
          .eq("id", row.id);
        byKind[kind].created++; totalCreated++;
      }

      if (!data.dryRun) {
        const genMs = Date.now() - genStartedAt;
        // Corrections manuelles = lignes explicitement révisées par un humain
        const { count: manualFixes } = await context.supabase.from("import_rows")
          .select("id", { count: "exact", head: true })
          .eq("job_id", data.jobId).not("reviewed_by", "is", null);

        await context.supabase.from("import_audit_logs").insert({
          shop_id: job.shop_id, job_id: data.jobId, actor_user_id: context.userId,
          actor_role: "shop", action: "job.entities_generated",
          details: { created: totalCreated, skipped: totalSkipped, errors: totalErrors, generation_ms: genMs, byKind } as never,
        });
        const { count } = await context.supabase.from("import_rows")
          .select("id", { count: "exact", head: true })
          .eq("job_id", data.jobId).eq("status", "ready").is("target_id", null);

        const finalOutcome: "success" | "partial" | "failed" =
          totalErrors > 0 && totalCreated === 0 ? "failed"
          : totalErrors > 0 ? "partial"
          : "success";

        const updatePatch: Record<string, unknown> = {
          metric_generation_ms: genMs,
          metric_rows_manual_fixes: manualFixes ?? 0,
          metric_final_outcome: finalOutcome,
        };
        if ((count ?? 0) === 0) updatePatch.status = "done";
        await context.supabase.from("import_jobs").update(updatePatch as never).eq("id", data.jobId);
      }

      return { created: totalCreated, skipped: totalSkipped, errors: totalErrors, byKind };
    } finally {
      if (!data.dryRun) {
        await context.supabase.rpc("release_import_generation_lock", { _job_id: data.jobId, _token: lockToken });
      }
    }
  });

// ---------- Beta pilote : liste blanche, suspension, tableau de bord, feedback ----------

/** Owner_bpei uniquement : ajoute / retire une boutique de la liste blanche pilote. */
export const setPilotAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    shopId: z.string().uuid(),
    enabled: z.boolean(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_ai_import_pilot_access", {
      _shop_id: data.shopId, _enabled: data.enabled,
    });
    if (error) throw new Error(error.message);
    return { ok: true, enabled: data.enabled };
  });

/** Owner_bpei uniquement : suspend un import en cours (cancel + audit). */
export const suspendImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    jobId: z.string().uuid(),
    reason: z.string().trim().max(500).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("suspend_import_job", {
      _job_id: data.jobId, _reason: data.reason ?? undefined,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Boutique : dépose un retour sur un import terminé (facultatif). */
export const submitImportFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    jobId: z.string().uuid(),
    ratingEase: z.number().int().min(1).max(5).optional(),
    ratingRecognition: z.number().int().min(1).max(5).optional(),
    timeSavedMinutes: z.number().int().min(0).max(100000).optional(),
    poorlyRecognized: z.string().trim().max(2000).optional(),
    missingFeature: z.string().trim().max(2000).optional(),
    comment: z.string().trim().max(4000).optional(),
    allowContact: z.boolean().default(false),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: job, error: jerr } = await context.supabase
      .from("import_jobs").select("id, shop_id").eq("id", data.jobId).maybeSingle();
    if (jerr) throw new Error(jerr.message);
    if (!job) throw new Error("Import introuvable");

    const { error } = await (context.supabase as unknown as {
      from: (t: string) => { upsert: (p: unknown, o?: unknown) => Promise<{ error: { message: string } | null }> }
    }).from("import_beta_feedback").upsert({
      shop_id: job.shop_id,
      job_id: data.jobId,
      submitted_by: context.userId,
      rating_ease: data.ratingEase ?? null,
      rating_recognition: data.ratingRecognition ?? null,
      time_saved_minutes: data.timeSavedMinutes ?? null,
      poorly_recognized: data.poorlyRecognized ?? null,
      missing_feature: data.missingFeature ?? null,
      comment: data.comment ?? null,
      allow_contact: data.allowContact,
    }, { onConflict: "job_id,submitted_by" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Boutique / owner_bpei : lit le retour déjà déposé (le cas échéant). */
export const getMyImportFeedback = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("import_beta_feedback")
      .select("*")
      .eq("job_id", data.jobId)
      .eq("submitted_by", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { feedback: row ?? null };
  });

/**
 * Owner_bpei : tableau de bord Beta — état global, boutiques pilotes,
 * volumétrie, réussite / partiel / échec, métriques agrégées, erreurs fréquentes.
 */
export const getPilotBetaOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ownerRes = await (context.supabase.rpc("is_owner_bpei", { _user: context.userId }) as unknown as Promise<{ data?: boolean }>);
    const isOwner = Boolean(ownerRes?.data);
    const isBpei = await isBpeiUser(context as never);
    if (!isBpei) throw new Error("Accès refusé");

    const runtimeEnv = resolveRuntimeEnvironment();
    const [previewFlagRes, prodFlagRes, shopsRes, jobsRes, feedbackRes] = await Promise.all([
      context.supabase.rpc("is_ai_import_enabled_env", { _env: "preview" }),
      context.supabase.rpc("is_ai_import_enabled_env", { _env: "production" }),
      context.supabase.from("shops")
        .select("id, name, ai_import_pilot_access, ai_import_pilot_granted_at")
        .eq("ai_import_pilot_access", true)
        .order("ai_import_pilot_granted_at", { ascending: false })
        .limit(200),
      context.supabase.from("import_jobs")
        .select("id, shop_id, title, kind, status, error, created_at, completed_at, metric_file_format, metric_file_bytes, metric_rows_total, metric_rows_recognized, metric_rows_errors, metric_rows_duplicates, metric_rows_manual_fixes, metric_parse_ms, metric_ai_ms, metric_generation_ms, metric_ai_cost_cents, metric_final_outcome")
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase.from("import_beta_feedback")
        .select("id, shop_id, job_id, rating_ease, rating_recognition, time_saved_minutes, comment, allow_contact, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);


    const jobs = jobsRes.data ?? [];
    const totals = {
      total: jobs.length,
      success: jobs.filter((j) => j.metric_final_outcome === "success").length,
      partial: jobs.filter((j) => j.metric_final_outcome === "partial").length,
      failed: jobs.filter((j) => j.metric_final_outcome === "failed").length,
      suspended: jobs.filter((j) => j.metric_final_outcome === "suspended").length,
      inProgress: jobs.filter((j) => !j.metric_final_outcome && j.status && !["done","completed","failed","cancelled"].includes(j.status)).length,
      rowsTotal: jobs.reduce((s, j) => s + (j.metric_rows_total ?? 0), 0),
      rowsRecognized: jobs.reduce((s, j) => s + (j.metric_rows_recognized ?? 0), 0),
      aiCostCents: jobs.reduce((s, j) => s + (j.metric_ai_cost_cents ?? 0), 0),
    };
    const durations = jobs
      .map((j) => (j.metric_parse_ms ?? 0) + (j.metric_ai_ms ?? 0) + (j.metric_generation_ms ?? 0))
      .filter((v) => v > 0);
    const avgDurationMs = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Erreurs fréquentes (agrégées depuis job.error)
    const errCounts = new Map<string, number>();
    for (const j of jobs) {
      const raw = (j.error ?? "").toString().trim();
      if (!raw) continue;
      const key = raw.slice(0, 120);
      errCounts.set(key, (errCounts.get(key) ?? 0) + 1);
    }
    const frequentErrors = Array.from(errCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([message, count]) => ({ message, count }));

    return {
      canToggleGlobalFlag: isOwner,
      runtimeEnvironment: runtimeEnv,
      environments: {
        preview: { enabled: !!previewFlagRes.data },
        production: { enabled: !!prodFlagRes.data },
      },
      // Compat rétro : `globalEnabled` reflète l'environnement courant.
      globalEnabled: runtimeEnv === "production"
        ? !!prodFlagRes.data
        : !!previewFlagRes.data,
      pilotShops: shopsRes.data ?? [],
      recentJobs: jobs.slice(0, 50),
      feedback: feedbackRes.data ?? [],
      totals,
      avgDurationMs,
      frequentErrors,
    };

  });

/** Owner_bpei : recherche minimaliste de boutiques par nom pour l'ajout à la liste blanche. */
export const searchShopsForPilot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ q: z.string().trim().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    const ownerRes = await (context.supabase.rpc("is_owner_bpei", { _user: context.userId }) as unknown as Promise<{ data?: boolean }>);
    if (!ownerRes?.data) throw new Error("Réservé aux owner_bpei");
    const { data: rows, error } = await context.supabase
      .from("shops")
      .select("id, name, ai_import_pilot_access")
      .ilike("name", `%${data.q}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return { shops: rows ?? [] };
  });