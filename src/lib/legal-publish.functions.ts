import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Bloc H1 — Publication juridique sécurisée.
 * Toute la sécurité vit dans les RPC Postgres SECURITY DEFINER
 * (publish_legal_document, create_legal_document_revision,
 * check_legal_document_publishable). Ces server fns ne sont qu'un
 * relais typé pour la console owner.
 */

export const checkLegalDocumentPublishable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ document_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc(
      "check_legal_document_publishable",
      { _document_id: data.document_id },
    );
    if (error) throw new Error(error.message);
    return res as { publishable: boolean; blockers: string[]; document_code?: string; version?: number; status?: string };
  });

export const publishLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      document_id: z.string().uuid(),
      effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("publish_legal_document", {
      _document_id: data.document_id,
      _effective_date: data.effective_date ?? undefined,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; document_id: string; previous_version_id: string | null; content_hash: string; published_at: string };
  });

export const createLegalDocumentRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ source_document_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: newId, error } = await context.supabase.rpc(
      "create_legal_document_revision",
      { _source_document_id: data.source_document_id },
    );
    if (error) throw new Error(error.message);
    return { new_document_id: newId as string };
  });