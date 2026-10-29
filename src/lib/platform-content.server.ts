import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Bloc H1 — Résolveur serveur central des contenus publics/juridiques.
 * Une seule source par domaine, jamais fusionnée en table unique :
 *   - platform_public_settings   → identité commerciale + navigation + SEO
 *   - platform_legal_settings    → identité légale (SIREN, hébergeur, DPO, médiateur)
 *   - legal_documents            → textes contractuels publiés (par code + langue)
 *
 * Aucune valeur factice, aucun fallback juridique inventé.
 * Un document en `draft` n'est JAMAIS retourné par les getters publics.
 */

function publicClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL/PUBLISHABLE_KEY manquants côté serveur");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export async function getPublishedPublicSettings() {
  // Passe par une RPC SECURITY DEFINER : la table n'a pas de policy anon.
  const { data } = await publicClient().rpc("get_published_platform_public_settings");
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function getPublishedLegalSettings() {
  const { data } = await publicClient().rpc("get_published_platform_legal_settings");
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

export async function getPublishedLegalDocument(documentCode: string, language: string = "fr") {
  // Bloc H2b — Accès public via RPC sécurisée uniquement (SELECT anon révoqué sur la table).
  const { data, error } = await publicClient().rpc("get_published_legal_document_public", {
    p_document_code: documentCode,
    p_language: language,
  });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    id: row.id,
    document_code: row.document_code,
    title: row.title,
    version: row.version,
    status: "published" as const,
    content: row.content,
    summary: row.summary,
    effective_date: row.effective_date,
    published_at: row.published_at,
    content_hash: row.content_hash,
    language: row.language,
    requires_acceptance: false,
  };
}

/**
 * Version draft — RÉSERVÉE à la console owner (prévisualisation privée).
 * Nécessite un client Supabase authentifié en owner_bpei ou admin_bpei.
 * L'appelant DOIT avoir vérifié le rôle en amont (le RLS de legal_documents l'exige aussi).
 */
export async function getDraftLegalDocumentForOwner(
  authedSupabase: SupabaseClient<Database>,
  documentCode: string,
  language: string = "fr",
) {
  const { data, error } = await authedSupabase
    .from("legal_documents")
    .select("*")
    .eq("document_code", documentCode)
    .eq("language", language)
    .in("status", ["draft", "under_review", "approved"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Structure combinée pour un rendu public — sans dupliquer les données.
 * Chaque champ conserve sa source d'origine.
 */
export async function getEffectivePlatformContent() {
  const [publicSettings, legalSettings] = await Promise.all([
    getPublishedPublicSettings(),
    getPublishedLegalSettings(),
  ]);
  return {
    public: publicSettings,
    legal: legalSettings,
  };
}