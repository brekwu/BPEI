/**
 * Import intelligent BPEI — Lot 3 : analyse IA via Lovable AI Gateway.
 *
 * Objectif : améliorer les lignes normalisées produites par le parsing (Lot 2)
 * en proposant, par lot de lignes, des corrections structurées : catégorisation
 * cohérente, descriptions manquantes, détection d'incohérences. Aucune écriture
 * automatique dans les tables métier — seules `import_rows.suggested` et
 * `import_jobs.ai_summary` sont alimentées, pour révision manuelle.
 */

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";
const CHUNK = 20;
const MAX_ROWS = 200;

export type EntityKind = "products" | "stock" | "services";

type RowInput = {
  id: string;
  index: number;
  normalized: Record<string, unknown>;
  errors?: string[];
};

export type RowSuggestion = {
  id: string;
  suggested: Record<string, unknown>;
  notes?: string;
  confidence?: number;
};

export type AiSummary = {
  model: string;
  generated_at: string;
  rows_analyzed: number;
  categories_detected: string[];
  insights: string[];
};

const SYSTEM_PROMPTS: Record<EntityKind, string> = {
  products:
    "Tu es un expert en catalogues produits pour boutiques indépendantes françaises. Pour chaque ligne, propose des améliorations concrètes : nom clair, description commerciale courte (max 240 caractères) si absente, catégorie normalisée (ex: 'Vélo', 'Pièce détachée', 'Accessoire'), TVA plausible (5.5, 10, 20). Ne modifie jamais un prix. Réponds uniquement en JSON.",
  services:
    "Tu es un expert en catalogues de services d'atelier (réparation, entretien) pour boutiques indépendantes françaises. Pour chaque prestation, propose : titre clair, description courte (max 240 caractères), catégorie normalisée, durée estimée en minutes si absente, TVA plausible. Ne modifie jamais un prix. Réponds uniquement en JSON.",
  stock:
    "Tu es un expert en gestion de stock atelier. Pour chaque pièce, propose : nom lisible, catégorie (ex: 'Freinage', 'Transmission', 'Consommable'), marque si évidente. Ne modifie jamais un prix ni une quantité. Réponds uniquement en JSON.",
};

async function callGateway(entity: EntityKind, batch: RowInput[]) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY manquant côté serveur.");

  const userPayload = {
    entity_kind: entity,
    rows: batch.map((r) => ({ id: r.id, index: r.index, normalized: r.normalized, errors: r.errors ?? [] })),
    instruction:
      "Retourne un objet JSON strict de la forme " +
      '{ "suggestions": [ { "id": string, "suggested": { ... }, "notes"?: string, "confidence"?: number } ], "categories": string[], "insights": string[] }. ' +
      "Ne renvoie que les champs modifiés dans `suggested`. Si aucune amélioration, omets la ligne.",
  };

  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[entity] },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (resp.status === 429) throw new Error("Limite d'appels IA atteinte, réessayez plus tard.");
  if (resp.status === 402) throw new Error("Crédits IA insuffisants sur l'espace de travail Lovable.");
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Analyse IA en échec (${resp.status}) : ${text.slice(0, 200)}`);
  }
  const data = await resp.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { parsed = {}; }
  const p = parsed as { suggestions?: RowSuggestion[]; categories?: string[]; insights?: string[] };
  return {
    suggestions: Array.isArray(p.suggestions) ? p.suggestions : [],
    categories: Array.isArray(p.categories) ? p.categories.filter((s) => typeof s === "string") : [],
    insights: Array.isArray(p.insights) ? p.insights.filter((s) => typeof s === "string") : [],
  };
}

export async function analyzeRowsWithAI(entity: EntityKind, rows: RowInput[]): Promise<{
  suggestions: RowSuggestion[];
  summary: AiSummary;
}> {
  const bounded = rows.slice(0, MAX_ROWS);
  const allSuggestions: RowSuggestion[] = [];
  const cats = new Set<string>();
  const insights: string[] = [];

  for (let i = 0; i < bounded.length; i += CHUNK) {
    const batch = bounded.slice(i, i + CHUNK);
    try {
      const r = await callGateway(entity, batch);
      for (const s of r.suggestions) {
        if (s && typeof s.id === "string" && s.suggested && typeof s.suggested === "object") {
          allSuggestions.push(s);
        }
      }
      r.categories.forEach((c) => cats.add(c));
      insights.push(...r.insights);
    } catch (e) {
      insights.push(`Erreur lot ${i / CHUNK + 1} : ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const summary: AiSummary = {
    model: MODEL,
    generated_at: new Date().toISOString(),
    rows_analyzed: bounded.length,
    categories_detected: Array.from(cats).slice(0, 40),
    insights: insights.slice(0, 20),
  };
  return { suggestions: allSuggestions, summary };
}