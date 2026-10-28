import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// Minimal RFC-4180-ish CSV parser: handles quoted fields with escaped quotes,
// commas and semicolons, LF/CRLF. Detects delimiter from the header line.
function parseCSV(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, "");
  if (!cleaned.trim()) return [];
  const firstLine = cleaned.slice(0, cleaned.indexOf("\n") >= 0 ? cleaned.indexOf("\n") : cleaned.length);
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c === '"') {
        if (cleaned[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function normalizeKey(s: string): string {
  return s.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function toRecords(text: string): Array<Record<string, string>> {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeKey);
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

function pick(rec: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) { const v = rec[k]; if (v && v.length > 0) return v; }
  return null;
}

function parseCents(s: string | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseNumber(s: string | null, def = 0): number {
  if (!s) return def;
  const cleaned = s.replace(/\s/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : def;
}

export type ImportKind = "customers" | "services" | "stock";

export interface ImportResult {
  inserted: number;
  errors: Array<{ row: number; message: string }>;
  total: number;
}

const kindSchema = z.enum(["customers", "services", "stock"]);

export const importCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; kind: ImportKind; csv: string }) =>
    z.object({ shopId: uuid, kind: kindSchema, csv: z.string().max(2_000_000) }).parse(i))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const records = toRecords(data.csv);
    const errors: ImportResult["errors"] = [];
    let inserted = 0;

    if (records.length === 0) return { inserted: 0, errors: [{ row: 0, message: "CSV vide ou en-têtes manquants" }], total: 0 };

    if (data.kind === "customers") {
      const rows = records.map((r) => ({
        shop_id: data.shopId,
        customer_type: (() => { const t = pick(r, "type", "customer_type")?.toLowerCase(); return t === "pro" || t === "company" || t === "business" || t === "societe" ? "business" as const : "individual" as const; })(),
        company_name: pick(r, "societe", "company", "company_name", "raison_sociale"),
        first_name: pick(r, "prenom", "first_name", "firstname"),
        last_name: pick(r, "nom", "last_name", "lastname", "nom_de_famille"),
        email: pick(r, "email", "e_mail", "mail")?.toLowerCase() ?? null,
        phone: pick(r, "telephone", "tel", "phone", "mobile"),
        address_line_1: pick(r, "adresse", "address", "adresse_1", "address_1"),
        postal_code: pick(r, "code_postal", "cp", "postal_code", "zip"),
        city: pick(r, "ville", "city"),
        country: pick(r, "pays", "country") ?? "France",
        created_by: context.userId,
      }));
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.first_name && !row.last_name && !row.company_name && !row.email && !row.phone) {
          errors.push({ row: i + 2, message: "Aucun identifiant (nom, société, email ou téléphone)" }); continue;
        }
        const { error } = await context.supabase.from("customers").insert(row);
        if (error) errors.push({ row: i + 2, message: error.message });
        else inserted++;
      }
      return { inserted, errors, total: rows.length };
    }

    if (data.kind === "services") {
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const name = pick(r, "nom", "name", "libelle");
        if (!name) { errors.push({ row: i + 2, message: "Nom manquant" }); continue; }
        const priceCents = parseCents(pick(r, "prix_ht", "prix", "price", "unit_price", "prix_unitaire")) ?? 0;
        const row = {
          shop_id: data.shopId,
          name,
          description: pick(r, "description", "detail"),
          category: pick(r, "categorie", "category"),
          unit: pick(r, "unite", "unit") ?? "unité",
          unit_price_cents: priceCents,
          tax_rate: parseNumber(pick(r, "tva", "tax", "tax_rate"), 20),
          estimated_duration_minutes: (() => {
            const v = pick(r, "duree", "duration", "duration_minutes");
            const n = v ? Math.round(parseNumber(v)) : NaN;
            return Number.isFinite(n) && n > 0 ? n : null;
          })(),
          internal_reference: pick(r, "reference", "ref"),
          active: true,
          created_by: context.userId,
        };
        const { error } = await context.supabase.from("service_catalog").insert(row);
        if (error) errors.push({ row: i + 2, message: error.message });
        else inserted++;
      }
      return { inserted, errors, total: records.length };
    }

    // stock
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const name = pick(r, "nom", "name", "libelle");
      if (!name) { errors.push({ row: i + 2, message: "Nom manquant" }); continue; }
      const row = {
        shop_id: data.shopId,
        sku: pick(r, "sku", "reference", "ref"),
        barcode: pick(r, "code_barre", "barcode", "ean"),
        name,
        description: pick(r, "description", "detail"),
        category: pick(r, "categorie", "category"),
        brand: pick(r, "marque", "brand"),
        unit: pick(r, "unite", "unit") ?? "unité",
        cost_price_cents: parseCents(pick(r, "prix_achat", "cost", "cost_price")) ?? 0,
        sell_price_cents: parseCents(pick(r, "prix_vente", "prix", "price", "sell_price")) ?? 0,
        tax_rate: parseNumber(pick(r, "tva", "tax", "tax_rate"), 20),
        quantity: parseNumber(pick(r, "quantite", "quantity", "stock"), 0),
        min_threshold: parseNumber(pick(r, "seuil", "min_threshold", "min"), 0),
        location: pick(r, "emplacement", "location"),
        active: true,
        created_by: context.userId,
      };
      const { error } = await context.supabase.from("stock_items").insert(row);
      if (error) errors.push({ row: i + 2, message: error.message });
      else inserted++;
    }
    return { inserted, errors, total: records.length };
  });