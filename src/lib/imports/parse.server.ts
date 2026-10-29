/**
 * Import intelligent BPEI — Lot 2 : parsing structuré et normalisation.
 *
 * Ce module lit un fichier CSV/XLSX depuis le bucket privé `imports-sources`,
 * détecte les colonnes de manière heuristique et produit des lignes normalisées
 * prêtes pour la relecture manuelle. Aucune analyse IA — 100% déterministe.
 */
import * as XLSX from "xlsx";

export type EntityKind = "products" | "stock" | "services";

export type ParsedRow = {
  sourceIndex: number;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  errors: string[];
};

export type ParseResult = {
  entityKind: EntityKind;
  columnMap: Record<string, string>;
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
  droppedRows: number;
};

const MAX_ROWS = 5000;

/** Normalise un en-tête de colonne pour la détection heuristique. */
function normalizeHeader(h: string): string {
  return h
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Dictionnaire heuristique : champ canonique → variantes de header courantes. */
const COLUMN_ALIASES: Record<EntityKind, Record<string, string[]>> = {
  products: {
    name: ["name", "nom", "libelle", "designation", "produit", "title", "titre"],
    description: ["description", "desc", "details"],
    category: ["category", "categorie", "famille", "rayon"],
    internal_reference: ["reference", "ref", "sku", "code"],
    unit_price_cents: ["price", "prix", "prix_ttc", "prix_ht", "tarif", "unit_price"],
    tax_rate: ["tva", "tax", "taux_tva", "tax_rate"],
    unit: ["unit", "unite"],
    estimated_duration_minutes: ["duration", "duree", "minutes"],
  },
  services: {
    name: ["name", "nom", "libelle", "designation", "service", "prestation"],
    description: ["description", "desc"],
    category: ["category", "categorie"],
    internal_reference: ["reference", "ref", "code"],
    unit_price_cents: ["price", "prix", "prix_ttc", "prix_ht", "tarif"],
    tax_rate: ["tva", "tax", "taux_tva"],
    unit: ["unit", "unite"],
    estimated_duration_minutes: ["duration", "duree", "minutes", "temps"],
  },
  stock: {
    name: ["name", "nom", "libelle", "designation", "produit"],
    sku: ["sku", "reference", "ref", "code"],
    barcode: ["barcode", "ean", "gencod", "code_barre", "code_barres"],
    description: ["description", "desc"],
    category: ["category", "categorie", "famille"],
    brand: ["brand", "marque"],
    unit: ["unit", "unite"],
    cost_price_cents: ["cost", "cout", "prix_achat", "achat", "cost_price"],
    sell_price_cents: ["price", "prix", "prix_vente", "vente", "sell_price", "tarif"],
    tax_rate: ["tva", "tax", "taux_tva"],
    quantity: ["quantity", "quantite", "qty", "stock", "qte"],
    min_threshold: ["seuil", "min", "minimum", "stock_min"],
    location: ["location", "emplacement", "rayon"],
  },
};

/** Choisit le mapping colonne → champ canonique le plus probable. */
function detectColumnMap(headers: string[], entity: EntityKind): Record<string, string> {
  const aliases = COLUMN_ALIASES[entity];
  const map: Record<string, string> = {};
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const [canonical, variants] of Object.entries(aliases)) {
    for (const h of normHeaders) {
      if (variants.includes(h.norm)) {
        map[h.raw] = canonical;
        break;
      }
    }
  }
  return map;
}

/** Convertit une valeur libre en centimes (accepte "12,50", "12.50 €", "1 234,56"). */
function toCents(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = String(value)
    .replace(/[^\d,.\-]/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  const parts = cleaned.split(".");
  const normalized = parts.length > 2
    ? parts.slice(0, -1).join("") + "." + parts.at(-1)
    : cleaned;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toStr(value: unknown, max = 500): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normalizePhone(value: unknown): string | null {
  const s = toStr(value, 40);
  if (!s) return null;
  return s.replace(/[^\d+]/g, "").slice(0, 20) || null;
}

function normalizeEmail(value: unknown): string | null {
  const s = toStr(value, 200);
  if (!s) return null;
  const lower = s.toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower) ? lower : null;
}

/** Normalise une ligne selon l'entité cible. */
function normalizeRow(
  raw: Record<string, unknown>,
  columnMap: Record<string, string>,
  entity: EntityKind,
): { normalized: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const normalized: Record<string, unknown> = {};
  for (const [header, value] of Object.entries(raw)) {
    const canonical = columnMap[header];
    if (!canonical) continue;
    if (canonical.endsWith("_price_cents")) {
      const cents = toCents(value);
      if (cents == null && value !== "" && value != null) errors.push(`Prix invalide (${canonical}): ${value}`);
      normalized[canonical] = cents ?? 0;
    } else if (canonical === "tax_rate" || canonical === "quantity" || canonical === "min_threshold" || canonical === "estimated_duration_minutes") {
      const n = toNumber(value);
      if (n == null && value !== "" && value != null) errors.push(`Nombre invalide (${canonical}): ${value}`);
      normalized[canonical] = n ?? (canonical === "tax_rate" ? 20 : 0);
    } else if (canonical === "email") {
      const e = normalizeEmail(value);
      if (!e && value) errors.push(`Email invalide: ${value}`);
      if (e) normalized.email = e;
    } else if (canonical === "phone") {
      const p = normalizePhone(value);
      if (p) normalized.phone = p;
    } else {
      const s = toStr(value);
      if (s) normalized[canonical] = s;
    }
  }
  if (!normalized.name) {
    errors.push("Nom obligatoire manquant");
  }

  return { normalized, errors };
}

/** Parse un buffer CSV/XLSX et retourne les lignes normalisées. */
export function parseWorkbookBuffer(
  buffer: ArrayBuffer,
  entityKind: EntityKind,
): ParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { entityKind, columnMap: {}, headers: [], rows: [], totalRows: 0, droppedRows: 0 };
  }
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "", raw: false, blankrows: false,
  });
  const totalRows = json.length;
  const bounded = json.slice(0, MAX_ROWS);
  const droppedRows = Math.max(0, totalRows - bounded.length);
  const headers = bounded.length > 0 ? Object.keys(bounded[0]) : [];
  const columnMap = detectColumnMap(headers, entityKind);
  const rows: ParsedRow[] = bounded.map((raw, i) => {
    const { normalized, errors } = normalizeRow(raw, columnMap, entityKind);
    return { sourceIndex: i + 2, raw, normalized, errors };
  });
  return { entityKind, columnMap, headers, rows, totalRows: bounded.length, droppedRows };
}

/** Cible SQL correspondant à l'entité. */
export const TARGET_TABLE: Record<EntityKind, string> = {
  products: "service_catalog",
  services: "service_catalog",
  stock: "stock_items",
};