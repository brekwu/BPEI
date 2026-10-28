/**
 * Server-only PDF rendering for versioned partnership agreements.
 * Rendered from the immutable snapshot stored in partner_agreement_versions,
 * NOT from live partner_agreements columns — the snapshot is the legal
 * source of truth for the given version_number/content_hash.
 */
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import React from "react";

export interface AgreementVersionSnapshot {
  title?: string | null;
  scope?: string | null;
  specialties?: string[] | null;
  covered_cities?: string[] | null;
  covered_postal_codes?: string[] | null;
  start_date?: string | null;
  end_date?: string | null;
  exclusivity_kind?: string | null;
  requires_exclusivity?: boolean | null;
  compensation_model?: string | null;
  compensation_details?: string | null;
  commission_terms?: string | null;
  travel_fee?: string | null;
  payment_terms?: string | null;
  invoicing_terms?: string | null;
  availability_requirements?: string | null;
  quality_requirements?: string | null;
  confidentiality?: string | null;
  termination_terms?: string | null;
  other_terms?: string | null;
  // Free-form extras allowed
  [key: string]: unknown;
}

export interface AgreementPdfInput {
  agreementId: string;
  versionNumber: number;
  contentHash: string;
  createdAt: string;
  changeSummary?: string | null;
  snapshot: AgreementVersionSnapshot;
  shop: { name?: string | null; city?: string | null; siret?: string | null; email?: string | null };
  independent: { name?: string | null; city?: string | null; siret?: string | null; email?: string | null };
  shopAcceptedAt?: string | null;
  independentAcceptedAt?: string | null;
  becameActiveAt?: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  brand: { fontSize: 18, fontWeight: 700, color: "#0f172a" },
  meta: { fontSize: 9, color: "#4b5563" },
  h1: { fontSize: 15, fontWeight: 700, marginBottom: 4 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 4, color: "#0f172a" },
  card: { border: "1pt solid #e5e7eb", borderRadius: 4, padding: 10, marginBottom: 8 },
  twoCol: { flexDirection: "row", gap: 12, marginBottom: 12 },
  col: { flex: 1 },
  label: { fontSize: 8, textTransform: "uppercase", color: "#6b7280", marginBottom: 2 },
  strong: { fontWeight: 700 },
  row: { marginBottom: 4 },
  hash: { fontSize: 8, color: "#374151", fontFamily: "Courier" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#6b7280", borderTop: "1pt solid #e5e7eb", paddingTop: 6 },
});

const SECTIONS: Array<{ title: string; fields: Array<{ key: keyof AgreementVersionSnapshot; label: string }> }> = [
  {
    title: "1. Objet et périmètre",
    fields: [
      { key: "title", label: "Objet de l'accord" },
      { key: "scope", label: "Périmètre" },
      { key: "specialties", label: "Services concernés" },
      { key: "covered_cities", label: "Villes couvertes" },
      { key: "covered_postal_codes", label: "Codes postaux" },
    ],
  },
  {
    title: "2. Durée et exclusivité",
    fields: [
      { key: "start_date", label: "Date de début" },
      { key: "end_date", label: "Date de fin" },
      { key: "exclusivity_kind", label: "Exclusivité" },
    ],
  },
  {
    title: "3. Rémunération et facturation",
    fields: [
      { key: "compensation_model", label: "Modèle de rémunération" },
      { key: "compensation_details", label: "Détail rémunération" },
      { key: "commission_terms", label: "Commissions contractuelles" },
      { key: "travel_fee", label: "Frais de déplacement" },
      { key: "payment_terms", label: "Délais de paiement" },
      { key: "invoicing_terms", label: "Facturation prévue" },
    ],
  },
  {
    title: "4. Obligations opérationnelles",
    fields: [
      { key: "availability_requirements", label: "Disponibilité requise" },
      { key: "quality_requirements", label: "Exigences qualité" },
    ],
  },
  {
    title: "5. Confidentialité et résiliation",
    fields: [
      { key: "confidentiality", label: "Confidentialité" },
      { key: "termination_terms", label: "Résiliation" },
      { key: "other_terms", label: "Autres conditions" },
    ],
  },
];

function fmt(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("fr-FR");
}

function PartyBlock({ label, p }: { label: string; p: AgreementPdfInput["shop"] }) {
  return (
    <View style={[styles.col, styles.card]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.strong}>{p.name ?? "—"}</Text>
      {p.city ? <Text>{p.city}</Text> : null}
      {p.siret ? <Text>SIRET : {p.siret}</Text> : null}
      {p.email ? <Text>{p.email}</Text> : null}
    </View>
  );
}

function AgreementView({ doc }: { doc: AgreementPdfInput }) {
  const active = doc.shopAcceptedAt && doc.independentAcceptedAt;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>Accord de partenariat BPEI</Text>
            <Text style={styles.meta}>Version {doc.versionNumber} · Émise le {fmtDate(doc.createdAt)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.h1}>{doc.snapshot.title ?? "Accord"}</Text>
            <Text style={styles.meta}>Réf. {doc.agreementId.slice(0, 8)}</Text>
            <Text style={styles.meta}>{active ? "Signé par les deux parties" : "En attente de signature"}</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <PartyBlock label="Boutique" p={doc.shop} />
          <PartyBlock label="Indépendant" p={doc.independent} />
        </View>

        {doc.changeSummary ? (
          <View style={styles.card}>
            <Text style={styles.label}>Résumé de cette version</Text>
            <Text>{doc.changeSummary}</Text>
          </View>
        ) : null}

        {SECTIONS.map((s) => {
          const rendered = s.fields
            .map((f) => ({ f, v: doc.snapshot[f.key] }))
            .filter(({ v }) => !(v == null || v === "" || (Array.isArray(v) && v.length === 0)));
          if (rendered.length === 0) return null;
          return (
            <View key={s.title} wrap={false}>
              <Text style={styles.h2}>{s.title}</Text>
              <View style={styles.card}>
                {rendered.map(({ f, v }) => (
                  <View key={String(f.key)} style={styles.row}>
                    <Text style={styles.label}>{f.label}</Text>
                    <Text>{fmt(v)}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <Text style={styles.h2}>6. Acceptations</Text>
        <View style={styles.card}>
          <Text>Boutique : {doc.shopAcceptedAt ? `acceptée le ${fmtDate(doc.shopAcceptedAt)}` : "en attente"}</Text>
          <Text>Indépendant : {doc.independentAcceptedAt ? `accepté le ${fmtDate(doc.independentAcceptedAt)}` : "en attente"}</Text>
          {doc.becameActiveAt ? <Text>Accord activé le {fmtDate(doc.becameActiveAt)}</Text> : null}
        </View>

        <Text style={styles.h2}>7. Empreinte contractuelle</Text>
        <View style={styles.card}>
          <Text>Empreinte SHA-256 de la version — garantit l'intégrité du contenu ci-dessus :</Text>
          <Text style={styles.hash}>{doc.contentHash}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>Document généré automatiquement par la plateforme BPEI à partir de la version {doc.versionNumber} figée.</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderAgreementPdfBase64(doc: AgreementPdfInput): Promise<string> {
  const instance = pdf(<AgreementView doc={doc} />);
  const blob = await instance.toBlob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  const g = globalThis as unknown as { btoa?: (s: string) => string; Buffer?: { from: (b: Uint8Array) => { toString: (fmt: string) => string } } };
  if (typeof g.btoa === "function") return g.btoa(binary);
  return g.Buffer!.from(buf).toString("base64");
}