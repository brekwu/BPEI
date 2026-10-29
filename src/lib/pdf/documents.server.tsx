/**
 * Server-only PDF rendering for quotes and invoices.
 * Uses @react-pdf/renderer. Never import this from client code —
 * the .server.tsx suffix and dynamic-import from server-fn handlers
 * keeps the bundle out of the browser.
 */
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import React from "react";

type Money = number; // cents
interface Line {
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price_cents: number;
  discount_percent: number;
  tax_rate: number;
}
interface Party {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  siret?: string | null;
  vat_number?: string | null;
}
export interface DocumentInput {
  kind: "quote" | "invoice" | "credit_note";
  number: string;
  issue_date: string;
  due_or_valid_date: string | null;
  currency: string;
  shop: Party;
  billing_settings?: {
    legal_form?: string | null;
    siret?: string | null;
    vat_number?: string | null;
    ape_code?: string | null;
    extra_mentions?: string | null;
    payment_terms?: string | null;
  } | null;
  customer: Party | null;
  lines: Line[];
  subtotal_cents: Money;
  discount_cents: Money;
  tax_cents: Money;
  total_cents: Money;
  amount_paid_cents?: Money;
  amount_due_cents?: Money;
  customer_message?: string | null;
  legal_mentions?: string | null;
  payment_terms?: string | null;
  logo_data_url?: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 20, fontWeight: 700, color: "#0f172a" },
  meta: { fontSize: 9, color: "#4b5563" },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  section: { marginBottom: 12 },
  card: { border: "1pt solid #e5e7eb", borderRadius: 4, padding: 10 },
  twoCol: { flexDirection: "row", gap: 12, marginBottom: 16 },
  col: { flex: 1 },
  label: { fontSize: 9, textTransform: "uppercase", color: "#6b7280", marginBottom: 3 },
  strong: { fontWeight: 700 },
  tableHead: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: 6, fontWeight: 700, fontSize: 9 },
  tableRow: { flexDirection: "row", padding: 6, borderBottom: "1pt solid #f3f4f6", fontSize: 9 },
  cDesc: { flex: 4 },
  cQty: { flex: 1, textAlign: "right" },
  cPrice: { flex: 1.4, textAlign: "right" },
  cTax: { flex: 1, textAlign: "right" },
  cTotal: { flex: 1.6, textAlign: "right" },
  totals: { marginTop: 12, alignSelf: "flex-end", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", padding: 3 },
  totalStrong: { flexDirection: "row", justifyContent: "space-between", padding: 6, backgroundColor: "#0f172a", color: "#ffffff", marginTop: 4, borderRadius: 3 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#6b7280", borderTop: "1pt solid #e5e7eb", paddingTop: 6 },
  small: { fontSize: 8, color: "#6b7280" },
});

function fmtMoney(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format((cents ?? 0) / 100);
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}
function partyName(p: Party | null | undefined): string {
  if (!p) return "";
  return p.name ?? "";
}
function partyLines(p: Party | null | undefined): string[] {
  if (!p) return [];
  const cityLine = [p.postal_code, p.city].filter(Boolean).join(" ");
  return [p.address ?? undefined, cityLine || undefined, p.country ?? undefined, p.email ?? undefined, p.phone ?? undefined]
    .filter((v): v is string => !!v && v.trim().length > 0);
}
function lineNet(l: Line) {
  const gross = l.quantity * l.unit_price_cents;
  const net = Math.round(gross * (1 - (l.discount_percent ?? 0) / 100));
  return net;
}

function DocView({ doc }: { doc: DocumentInput }) {
  const title = doc.kind === "invoice" ? "FACTURE"
    : doc.kind === "credit_note" ? "AVOIR" : "DEVIS";
  const dateLabel = doc.kind === "invoice" ? "Échéance"
    : doc.kind === "credit_note" ? "Émis le" : "Valable jusqu'au";
  const bs = doc.billing_settings ?? {};
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
              {bs.siret && <Text style={styles.meta}>SIRET : {bs.siret}{bs.ape_code ? `  ·  APE ${bs.ape_code}` : ""}</Text>}
              {bs.vat_number && <Text style={styles.meta}>TVA : {bs.vat_number}</Text>}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.h1}>{title}</Text>
            <Text style={styles.meta}>N° {doc.number}</Text>
            <Text style={styles.meta}>Émis le {fmtDate(doc.issue_date)}</Text>
            <Text style={styles.meta}>{dateLabel} {fmtDate(doc.due_or_valid_date)}</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Émetteur</Text>
            <Text style={styles.strong}>{partyName(doc.shop) || "—"}</Text>
            {partyLines(doc.shop).map((l, i) => (<Text key={i}>{l}</Text>))}
          </View>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.strong}>{partyName(doc.customer) || "Client non renseigné"}</Text>
            {partyLines(doc.customer).map((l, i) => (<Text key={i}>{l}</Text>))}
            {doc.customer?.siret && <Text>SIRET : {doc.customer.siret}</Text>}
            {doc.customer?.vat_number && <Text>TVA : {doc.customer.vat_number}</Text>}
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={styles.cDesc}>Désignation</Text>
          <Text style={styles.cQty}>Qté</Text>
          <Text style={styles.cPrice}>PU HT</Text>
          <Text style={styles.cTax}>TVA</Text>
          <Text style={styles.cTotal}>Total HT</Text>
        </View>
        {doc.lines.map((l, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <Text style={styles.cDesc}>
              {l.description}
              {l.discount_percent > 0 ? `  (−${l.discount_percent}%)` : ""}
            </Text>
            <Text style={styles.cQty}>{l.quantity}{l.unit ? ` ${l.unit}` : ""}</Text>
            <Text style={styles.cPrice}>{fmtMoney(l.unit_price_cents, doc.currency)}</Text>
            <Text style={styles.cTax}>{l.tax_rate}%</Text>
            <Text style={styles.cTotal}>{fmtMoney(lineNet(l), doc.currency)}</Text>
          </View>
        ))}
        {doc.lines.length === 0 && (
          <View style={styles.tableRow}><Text style={styles.cDesc}>Aucune ligne</Text></View>
        )}

        <View style={styles.totals}>
          <View style={styles.totalRow}><Text>Sous-total HT</Text><Text>{fmtMoney(doc.subtotal_cents, doc.currency)}</Text></View>
          {doc.discount_cents > 0 && (
            <View style={styles.totalRow}><Text>Remise</Text><Text>−{fmtMoney(doc.discount_cents, doc.currency)}</Text></View>
          )}
          <View style={styles.totalRow}><Text>TVA</Text><Text>{fmtMoney(doc.tax_cents, doc.currency)}</Text></View>
          <View style={styles.totalStrong}><Text>Total TTC</Text><Text>{fmtMoney(doc.total_cents, doc.currency)}</Text></View>
          {doc.kind === "invoice" && (doc.amount_paid_cents ?? 0) > 0 && (
            <>
              <View style={styles.totalRow}><Text>Payé</Text><Text>{fmtMoney(doc.amount_paid_cents ?? 0, doc.currency)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.strong}>Solde restant</Text><Text style={styles.strong}>{fmtMoney(doc.amount_due_cents ?? 0, doc.currency)}</Text></View>
            </>
          )}
        </View>

        {doc.customer_message && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.label}>Message</Text>
            <Text>{doc.customer_message}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          {doc.payment_terms && <Text>Conditions de paiement : {doc.payment_terms}</Text>}
          {doc.legal_mentions && <Text>{doc.legal_mentions}</Text>}
          {!doc.legal_mentions && bs.legal_form && (
            <Text>{doc.shop.name} · {bs.legal_form}{bs.siret ? ` · SIRET ${bs.siret}` : ""}</Text>
          )}
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderDocumentPdfBase64(doc: DocumentInput): Promise<string> {
  const instance = pdf(<DocView doc={doc} />);
  const blob = await instance.toBlob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Base64 encode without Node Buffer for maximum runtime portability.
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  // btoa exists in workerd; fall back to Buffer if not
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (typeof g.btoa === "function") return g.btoa(binary);
  return (g.Buffer as { from: (b: Uint8Array) => { toString: (fmt: string) => string } })
    .from(buf).toString("base64");
}