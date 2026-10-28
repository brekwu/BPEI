/**
 * Server-only PDF renderer for purchase orders (supplier documents).
 * Uses the same @react-pdf/renderer stack as invoices/quotes to keep
 * a single Worker-compatible pipeline.
 * Data comes from the frozen snapshot on purchase_orders (shop_snapshot,
 * supplier_snapshot, lines_snapshot) once the PO is sent; falls back to
 * live data for drafts.
 */
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import React from "react";

export interface POParty {
  name?: string | null;
  legal_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  siret?: string | null;
  vat_number?: string | null;
  contact_name?: string | null;
  payment_terms?: string | null;
  lead_time_days?: number | null;
}

export interface POLineInput {
  position: number;
  name: string;
  sku?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price_cents: number;
  tax_rate: number;
  notes?: string | null;
}

export interface PurchaseOrderInput {
  reference: string;
  order_date: string | null;
  expected_date: string | null;
  sent_at: string | null;
  status: string;
  currency?: string;
  shop: POParty;
  supplier: POParty;
  lines: POLineInput[];
  subtotal_ht_cents: number;
  tax_cents: number;
  total_ht_cents: number;
  total_ttc_cents: number;
  notes?: string | null;
  logo_data_url?: string | null;
  is_draft: boolean;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 20, fontWeight: 700, color: "#0f172a" },
  meta: { fontSize: 9, color: "#4b5563" },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  card: { border: "1pt solid #e5e7eb", borderRadius: 4, padding: 10 },
  twoCol: { flexDirection: "row", gap: 12, marginBottom: 16 },
  col: { flex: 1 },
  label: { fontSize: 9, textTransform: "uppercase", color: "#6b7280", marginBottom: 3 },
  strong: { fontWeight: 700 },
  draftBanner: {
    backgroundColor: "#fef3c7", color: "#92400e", padding: 6, textAlign: "center",
    marginBottom: 12, borderRadius: 3, fontWeight: 700, fontSize: 10,
  },
  tableHead: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: 6, fontWeight: 700, fontSize: 9 },
  tableRow: { flexDirection: "row", padding: 6, borderBottom: "1pt solid #f3f4f6", fontSize: 9 },
  cIdx: { width: 22 },
  cDesc: { flex: 4 },
  cQty: { flex: 1, textAlign: "right" },
  cPrice: { flex: 1.4, textAlign: "right" },
  cTax: { flex: 0.8, textAlign: "right" },
  cTotal: { flex: 1.6, textAlign: "right" },
  sku: { fontSize: 8, color: "#6b7280" },
  totals: { marginTop: 12, alignSelf: "flex-end", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", padding: 3 },
  totalStrong: {
    flexDirection: "row", justifyContent: "space-between", padding: 6,
    backgroundColor: "#0f172a", color: "#ffffff", marginTop: 4, borderRadius: 3,
  },
  footer: {
    position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8,
    color: "#6b7280", borderTop: "1pt solid #e5e7eb", paddingTop: 6,
  },
});

function fmtMoney(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency })
    .format((cents ?? 0) / 100);
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}
function partyName(p: POParty | null | undefined): string {
  if (!p) return "";
  return p.legal_name ?? p.name ?? "";
}
function partyLines(p: POParty | null | undefined): string[] {
  if (!p) return [];
  const cityLine = [p.postal_code, p.city].filter(Boolean).join(" ");
  return [
    p.address_line1 ?? undefined,
    p.address_line2 ?? undefined,
    cityLine || undefined,
    p.country ?? undefined,
    p.email ?? undefined,
    p.phone ?? undefined,
  ].filter((v): v is string => !!v && v.trim().length > 0);
}
function lineNet(l: POLineInput): number {
  return Math.round(l.quantity * l.unit_price_cents);
}

function POView({ doc }: { doc: PurchaseOrderInput }) {
  const currency = doc.currency ?? "EUR";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", flex: 1 }}>
            {doc.logo_data_url && (
              <Image src={doc.logo_data_url} style={{ width: 64, height: 64, objectFit: "contain" }} />
            )}
            <View>
              <Text style={styles.brand}>{doc.shop.name ?? "Boutique"}</Text>
              {partyLines(doc.shop).map((l, i) => (<Text key={i} style={styles.meta}>{l}</Text>))}
              {doc.shop.siret && <Text style={styles.meta}>SIRET : {doc.shop.siret}</Text>}
              {doc.shop.vat_number && <Text style={styles.meta}>TVA : {doc.shop.vat_number}</Text>}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.h1}>BON DE COMMANDE</Text>
            <Text style={styles.meta}>N° {doc.reference}</Text>
            <Text style={styles.meta}>Émis le {fmtDate(doc.order_date)}</Text>
            {doc.expected_date && (
              <Text style={styles.meta}>Livraison prévue {fmtDate(doc.expected_date)}</Text>
            )}
            {doc.sent_at && (
              <Text style={styles.meta}>Envoyé le {fmtDate(doc.sent_at)}</Text>
            )}
          </View>
        </View>

        {doc.is_draft && (
          <View style={styles.draftBanner}>
            <Text>BROUILLON — non envoyé au fournisseur</Text>
          </View>
        )}

        <View style={styles.twoCol}>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Émetteur (boutique)</Text>
            <Text style={styles.strong}>{partyName(doc.shop) || "—"}</Text>
            {partyLines(doc.shop).map((l, i) => (<Text key={i}>{l}</Text>))}
          </View>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Fournisseur</Text>
            <Text style={styles.strong}>{partyName(doc.supplier) || "—"}</Text>
            {doc.supplier.contact_name && <Text>À l'attention de {doc.supplier.contact_name}</Text>}
            {partyLines(doc.supplier).map((l, i) => (<Text key={i}>{l}</Text>))}
            {doc.supplier.vat_number && <Text>TVA : {doc.supplier.vat_number}</Text>}
            {doc.supplier.payment_terms && (
              <Text style={{ marginTop: 4 }}>Conditions : {doc.supplier.payment_terms}</Text>
            )}
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.cIdx}>#</Text>
          <Text style={styles.cDesc}>Désignation</Text>
          <Text style={styles.cQty}>Qté</Text>
          <Text style={styles.cPrice}>PU HT</Text>
          <Text style={styles.cTax}>TVA</Text>
          <Text style={styles.cTotal}>Total HT</Text>
        </View>
        {doc.lines.map((l, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <Text style={styles.cIdx}>{i + 1}</Text>
            <View style={styles.cDesc}>
              <Text>{l.name}</Text>
              {l.sku && <Text style={styles.sku}>Réf. {l.sku}</Text>}
              {l.notes && <Text style={styles.sku}>{l.notes}</Text>}
            </View>
            <Text style={styles.cQty}>{l.quantity}{l.unit ? ` ${l.unit}` : ""}</Text>
            <Text style={styles.cPrice}>{fmtMoney(l.unit_price_cents, currency)}</Text>
            <Text style={styles.cTax}>{l.tax_rate}%</Text>
            <Text style={styles.cTotal}>{fmtMoney(lineNet(l), currency)}</Text>
          </View>
        ))}
        {doc.lines.length === 0 && (
          <View style={styles.tableRow}><Text style={styles.cDesc}>Aucune ligne</Text></View>
        )}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Sous-total HT</Text>
            <Text>{fmtMoney(doc.subtotal_ht_cents, currency)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>TVA</Text>
            <Text>{fmtMoney(doc.tax_cents, currency)}</Text>
          </View>
          <View style={styles.totalStrong}>
            <Text>Total TTC</Text>
            <Text>{fmtMoney(doc.total_ttc_cents, currency)}</Text>
          </View>
        </View>

        {doc.notes && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.label}>Notes internes</Text>
            <Text>{doc.notes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            Bon de commande émis par {doc.shop.name ?? "la boutique"}
            {doc.shop.siret ? ` · SIRET ${doc.shop.siret}` : ""}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderPurchaseOrderPdfBase64(doc: PurchaseOrderInput): Promise<string> {
  const instance = pdf(<POView doc={doc} />);
  const blob = await instance.toBlob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  const g = globalThis as unknown as {
    btoa?: (s: string) => string;
    Buffer?: { from: (b: Uint8Array) => { toString: (fmt: string) => string } };
  };
  if (typeof g.btoa === "function") return g.btoa(binary);
  return g.Buffer!.from(buf).toString("base64");
}