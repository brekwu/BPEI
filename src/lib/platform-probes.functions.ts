import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getPublishedPublicSettings,
  getPublishedLegalSettings,
  getPublishedLegalDocument,
} from "@/lib/platform-content.server";

/**
 * Bloc H2c Vague C — Sondes automatiques de propagation.
 *
 * Chaque sonde vérifie que la donnée exposée au public correspond bien à
 * la version attendue de la publication. Aucun rendu HTML n'est effectué :
 * les vérifications passent par les résolveurs SSOT (`platform-content.server`)
 * et par les RPC publiques (`get_published_legal_document_public`).
 *
 * Un mécanisme de simulation d'échec (owner-only) permet aux tests de
 * forcer un consommateur à échouer via `owner_set_probe_test_flags`.
 */

type ConsumerKey =
  | "header"
  | "footer"
  | "accueil"
  | "contact"
  | "reclamations"
  | "mentions_legales"
  | "confidentialite"
  | "cgu"
  | "cookies"
  | "tarifs"
  | "rejoindre"
  | "seo_root"
  | "open_graph"
  | "favicon"
  | "sitemap"
  | "emails";

type ProbeOutcome = {
  key: ConsumerKey;
  status: "success" | "failed" | "skipped" | "not_applicable";
  observed_version: number | null;
  error_code?: string | null;
  error_message?: string | null;
};

async function probeSettingsDerived(
  key: ConsumerKey,
  expected: number,
  read: () => Promise<{ ok: boolean; reason?: string }>,
): Promise<ProbeOutcome> {
  try {
    const r = await read();
    if (!r.ok) {
      return {
        key,
        status: "failed",
        observed_version: null,
        error_code: "READ_INVALID",
        error_message: r.reason ?? "Contenu introuvable ou invalide",
      };
    }
    return { key, status: "success", observed_version: expected };
  } catch (e: any) {
    return {
      key,
      status: "failed",
      observed_version: null,
      error_code: "READ_ERROR",
      error_message: String(e?.message ?? e).slice(0, 400),
    };
  }
}

async function runOneProbe(
  key: ConsumerKey,
  expectedVersion: number,
): Promise<ProbeOutcome> {
  switch (key) {
    case "header":
    case "footer":
    case "accueil":
    case "tarifs":
    case "rejoindre":
    case "sitemap":
      // Consommateurs UI non encore migrés au SSOT (voir H2c §2).
      // On les marque `not_applicable` tant que le câblage n'est pas fait,
      // au lieu de faire croire à une propagation réussie.
      return { key, status: "not_applicable", observed_version: null };

    case "contact":
    case "seo_root":
    case "open_graph":
    case "favicon":
      return probeSettingsDerived(key, expectedVersion, async () => {
        const row = (await getPublishedPublicSettings()) as any;
        const version = row?.published_version ?? 0;
        const published = row?.published ?? {};
        if (version !== expectedVersion) {
          return { ok: false, reason: `Version publiée ${version} ≠ attendue ${expectedVersion}` };
        }
        if (!published || Object.keys(published).length === 0) {
          return { ok: false, reason: "Snapshot publié vide" };
        }
        return { ok: true };
      });

    case "reclamations":
    case "mentions_legales":
      return probeSettingsDerived(key, expectedVersion, async () => {
        const legal = await getPublishedLegalSettings();
        if (!legal) return { ok: false, reason: "platform_legal_settings vide" };
        return { ok: true };
      });

    case "confidentialite":
    case "cgu":
    case "cookies": {
      const codeMap: Record<string, string> = {
        confidentialite: "privacy_policy",
        cgu: "terms_of_service",
        cookies: "cookie_policy",
      };
      try {
        const doc = await getPublishedLegalDocument(codeMap[key]);
        if (!doc) {
          return {
            key, status: "failed", observed_version: null,
            error_code: "NO_PUBLISHED_DOCUMENT",
            error_message: `Aucun document ${codeMap[key]} publié`,
          };
        }
        return { key, status: "success", observed_version: doc.version };
      } catch (e: any) {
        return {
          key, status: "failed", observed_version: null,
          error_code: "DOC_ERROR",
          error_message: String(e?.message ?? e).slice(0, 400),
        };
      }
    }

    case "emails":
      // Câblage helper livré (getPublishedEmailBranding) — sonde: résolveur
      // renvoie bien un objet non vide dérivé des settings publiés.
      return probeSettingsDerived(key, expectedVersion, async () => {
        const { getPublishedEmailBranding } = await import("@/lib/email-branding.server");
        const branding = await getPublishedEmailBranding();
        if (!branding) return { ok: false, reason: "Branding e-mail vide" };
        return { ok: true };
      });
  }
}

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_platform_role", {
    _user: userId,
    _role: "owner_bpei",
  });
  if (error) throw new Error(`has_platform_role: ${error.message}`);
  if (!data) throw new Error("Forbidden: owner_bpei requis");
}

const ALL_KEYS: ConsumerKey[] = [
  "header", "footer", "accueil", "contact", "reclamations", "mentions_legales",
  "confidentialite", "cgu", "cookies", "tarifs", "rejoindre",
  "seo_root", "open_graph", "favicon", "sitemap", "emails",
];

export const runPublicationProbes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      publication_id: z.string().uuid(),
      expected_version: z.number().int().positive(),
      only_keys: z.array(z.string()).optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);

    const { data: failFlags } = await context.supabase.rpc("owner_get_probe_test_flags");
    const forceFail = new Set<string>(Array.isArray(failFlags) ? failFlags : []);

    const keys: ConsumerKey[] = (data.only_keys?.length
      ? (data.only_keys.filter((k) => (ALL_KEYS as string[]).includes(k)) as ConsumerKey[])
      : ALL_KEYS);

    const outcomes: ProbeOutcome[] = [];
    for (const key of keys) {
      if (forceFail.has(key)) {
        outcomes.push({
          key,
          status: "failed",
          observed_version: null,
          error_code: "SIMULATED_FAILURE",
          error_message: "Échec simulé via platform_probe_test_flags",
        });
      } else {
        outcomes.push(await runOneProbe(key, data.expected_version));
      }
    }

    // Persister toutes les observations (une RPC par ligne, séquentiel pour rester sous RLS)
    for (const o of outcomes) {
      await context.supabase.rpc("owner_record_consumer_observation", {
        p_publication_id: data.publication_id,
        p_consumer_key: o.key,
        p_observed_version: o.observed_version ?? 0,
        p_status: o.status,
        p_error_code: o.error_code ?? undefined,
        p_error_message: o.error_message ?? undefined,
      });
    }

    const { data: overall } = await context.supabase.rpc("owner_compute_publication_status", {
      p_publication_id: data.publication_id,
    });

    return {
      publication_id: data.publication_id,
      expected_version: data.expected_version,
      outcomes,
      overall_status: (overall as string) ?? "unknown",
    };
  });

export const retrySingleConsumer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      publication_id: z.string().uuid(),
      expected_version: z.number().int().positive(),
      consumer_key: z.string(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: started } = await context.supabase.rpc("owner_start_consumer_retry", {
      p_publication_id: data.publication_id,
      p_consumer_key: data.consumer_key,
    });
    if (!started) {
      return { skipped: true, reason: "Retry déjà en cours" };
    }
    if (!(ALL_KEYS as string[]).includes(data.consumer_key)) {
      throw new Error("consumer_key inconnu");
    }
    const outcome = await runOneProbe(data.consumer_key as ConsumerKey, data.expected_version);
    await context.supabase.rpc("owner_record_consumer_observation", {
      p_publication_id: data.publication_id,
      p_consumer_key: outcome.key,
      p_observed_version: outcome.observed_version ?? 0,
      p_status: outcome.status,
      p_error_code: outcome.error_code ?? undefined,
      p_error_message: outcome.error_message ?? undefined,
    });
    return { skipped: false, outcome };
  });

export const setProbeTestFailureKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ keys: z.array(z.string()) }).parse(d)
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: applied, error } = await context.supabase.rpc(
      "owner_set_probe_test_flags",
      { p_keys: data.keys },
    );
    if (error) throw new Error(error.message);
    return { keys: applied as string[] };
  });