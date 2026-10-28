import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getPublishedLegalDocument } from "@/lib/platform-content.server";

/**
 * Bloc H2 — Wrapper serveur du résolveur central pour la lecture PUBLIQUE
 * d'un document juridique publié (SSR-safe, sans session).
 *
 * Règles :
 *  - Ne retourne QUE des versions `published`.
 *  - Retourne `null` si aucun document publié — jamais un draft, jamais un fallback inventé.
 *  - Consommé par les routes publiques (loader) et par la prévisualisation owner (via un wrapper séparé qui pourra retourner un draft).
 */
export const getPublishedLegalDocumentFn = createServerFn({ method: "GET" })
  .validator((data: { code: string; language?: string }) =>
    z.object({
      code: z.string().min(1).max(64),
      language: z.string().min(2).max(5).default("fr"),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const doc = await getPublishedLegalDocument(data.code, data.language);
    if (!doc) return null;
    return {
      id: doc.id,
      code: doc.document_code,
      title: doc.title,
      version: doc.version,
      content: doc.content,
      summary: doc.summary,
      effective_date: doc.effective_date,
      published_at: doc.published_at,
      content_hash: doc.content_hash,
      language: doc.language,
    };
  });