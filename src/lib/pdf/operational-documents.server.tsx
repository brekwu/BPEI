/**
 * PDF opérationnels partageant l'en-tête / pied : reçu de paiement,
 * confirmation de rendez-vous, fiche de réparation, bon de dépôt.
 * Utilise le même moteur (@react-pdf/renderer) que quotes/invoices.
 */
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import React from "react";

interface Shop {
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

interface HeaderProps {
  title: string;
  subtitle?: string | null;
  shop: Shop;
  logo_data_url?: string | null;
  ref_number?: string | null;
  date_iso?: string | null;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#111827" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 18, fontWeight: 700, color: "#0f172a" },
  meta: { fontSize: 9, color: "#4b5563" },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  section: { marginBottom: 14 },
  label: { fontSize: 9, textTransform: "uppercase", color: "#6b7280", marginBottom: 3 },
  strong: { fontWeight: 700 },
  card: { border: "1pt solid #e5e7eb", borderRadius: 4, padding: 10 },
  twoCol: { flexDirection: "row", gap: 12, marginBottom: 14 },
  col: { flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 4 },
  totalStrong: {
    flexDirection: "row", justifyContent: "space-between",
    padding: 6, backgroundColor: "#0f172a", color: "#ffffff",
    marginTop: 6, borderRadius: 3,
  },
  footer: {
    position: "absolute", bottom: 24, left: 40, right: 40,
    fontSize: 8, color: "#6b7280",
    borderTop: "1pt solid #e5e7eb", paddingTop: 6,
  },
  small: { fontSize: 8, color: "#6b7280" },
  tableHead: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: 6, fontWeight: 700, fontSize: 9 },
  tableRow: { flexDirection: "row", padding: 6, borderBottom: "1pt solid #f3f4f6", fontSize: 9 },
});

function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return withTime
    ? d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })
    : d.toLocaleDateString("fr-FR");
}

function fmtMoney(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format((cents ?? 0) / 100);
}

function shopLines(s: Shop): string[] {
  const cityLine = [s.postal_code, s.city].filter(Boolean).join(" ");
  return [s.address ?? undefined, cityLine || undefined, s.country ?? undefined, s.email ?? undefined, s.phone ?? undefined]
    .filter((v): v is string => !!v && v.trim().length > 0);
}

function Header({ title, subtitle, shop, logo_data_url, ref_number, date_iso }: HeaderProps) {
  return (
    <View style={styles.headerRow}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", flex: 1 }}>
        {logo_data_url && (
          <Image src={logo_data_url} style={{ width: 60, height: 60, objectFit: "contain" }} />
        )}
        <View>
          <Text style={styles.brand}>{shop.name ?? "Boutique"}</Text>
          {shopLines(shop).map((l, i) => (<Text key={i} style={styles.meta}>{l}</Text>))}
          {shop.siret && <Text style={styles.meta}>SIRET : {shop.siret}</Text>}
          {shop.vat_number && <Text style={styles.meta}>TVA : {shop.vat_number}</Text>}
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.h1}>{title}</Text>
        {subtitle && <Text style={styles.meta}>{subtitle}</Text>}
        {ref_number && <Text style={styles.meta}>N° {ref_number}</Text>}
        {date_iso && <Text style={styles.meta}>{fmtDate(date_iso)}</Text>}
      </View>
    </View>
  );
}

function Footer({ mentions }: { mentions?: string | null }) {
  return (
    <View style={styles.footer} fixed>
      {mentions && <Text>{mentions}</Text>}
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

/* ============ PAYMENT RECEIPT ============ */

export interface PaymentReceiptInput {
  shop: Shop;
  logo_data_url?: string | null;
  receipt_number: string;
  invoice_number: string | null;
  paid_at: string;
  method: string;
  reference?: string | null;
  amount_cents: number;
  currency: string;
  customer_name?: string | null;
  invoice_total_cents?: number | null;
  invoice_paid_cents?: number | null;
  invoice_due_cents?: number | null;
  legal_mentions?: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Espèces", card: "Carte bancaire", transfer: "Virement",
  check: "Chèque", other: "Autre", stripe: "Stripe",
};

function ReceiptDoc({ d }: { d: PaymentReceiptInput }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header
          title="REÇU DE PAIEMENT" shop={d.shop} logo_data_url={d.logo_data_url}
          ref_number={d.receipt_number} date_iso={d.paid_at}
        />
        <View style={styles.twoCol}>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.strong}>{d.customer_name ?? "—"}</Text>
          </View>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Facture</Text>
            <Text style={styles.strong}>{d.invoice_number ?? "—"}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.section]}>
          <View style={styles.row}><Text>Date du paiement</Text><Text>{fmtDate(d.paid_at, true)}</Text></View>
          <View style={styles.row}><Text>Moyen</Text><Text>{METHOD_LABEL[d.method] ?? d.method}</Text></View>
          {d.reference && <View style={styles.row}><Text>Référence</Text><Text>{d.reference}</Text></View>}
          <View style={styles.totalStrong}>
            <Text>Montant réglé</Text>
            <Text>{fmtMoney(d.amount_cents, d.currency)}</Text>
          </View>
          {(d.invoice_total_cents != null) && (
            <>
              <View style={styles.row}><Text>Total facture</Text><Text>{fmtMoney(d.invoice_total_cents, d.currency)}</Text></View>
              <View style={styles.row}><Text>Total réglé</Text><Text>{fmtMoney(d.invoice_paid_cents ?? 0, d.currency)}</Text></View>
              <View style={styles.row}>
                <Text style={styles.strong}>Solde restant</Text>
                <Text style={styles.strong}>{fmtMoney(d.invoice_due_cents ?? 0, d.currency)}</Text>
              </View>
            </>
          )}
        </View>
        <Text style={styles.small}>
          Ce reçu atteste le règlement partiel ou total ci-dessus. Il ne remplace pas la facture originale.
        </Text>
        <Footer mentions={d.legal_mentions} />
      </Page>
    </Document>
  );
}

/* ============ APPOINTMENT CONFIRMATION ============ */

export interface AppointmentConfirmationInput {
  shop: Shop;
  logo_data_url?: string | null;
  appointment_id: string;
  service_name: string | null;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  technician_name?: string | null;
  device_description?: string | null;
  problem_description?: string | null;
  cancellation_policy?: string | null;
}

function AppointmentDoc({ d }: { d: AppointmentConfirmationInput }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header
          title="CONFIRMATION DE RDV" shop={d.shop} logo_data_url={d.logo_data_url}
          ref_number={d.appointment_id.slice(0, 8).toUpperCase()}
          date_iso={d.starts_at}
        />
        <View style={styles.twoCol}>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.strong}>{d.customer_name}</Text>
            {d.customer_phone && <Text>{d.customer_phone}</Text>}
            {d.customer_email && <Text>{d.customer_email}</Text>}
          </View>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Rendez-vous</Text>
            <Text style={styles.strong}>{d.service_name ?? "Prestation"}</Text>
            <Text>Début : {fmtDate(d.starts_at, true)}</Text>
            <Text>Fin : {fmtDate(d.ends_at, true)}</Text>
            <Text>Durée : {d.duration_minutes} min</Text>
            {d.technician_name && <Text>Technicien : {d.technician_name}</Text>}
          </View>
        </View>

        {(d.device_description || d.problem_description) && (
          <View style={[styles.card, styles.section]}>
            {d.device_description && (
              <>
                <Text style={styles.label}>Appareil</Text>
                <Text>{d.device_description}</Text>
              </>
            )}
            {d.problem_description && (
              <>
                <Text style={[styles.label, { marginTop: 6 }]}>Panne déclarée</Text>
                <Text>{d.problem_description}</Text>
              </>
            )}
          </View>
        )}

        <View style={[styles.card, styles.section]}>
          <Text style={styles.label}>Lieu du rendez-vous</Text>
          <Text style={styles.strong}>{d.shop.name}</Text>
          {shopLines(d.shop).map((l, i) => (<Text key={i}>{l}</Text>))}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Conditions d'annulation</Text>
          <Text style={styles.small}>
            {d.cancellation_policy
              ?? "Merci de nous prévenir au moins 24h à l'avance en cas d'empêchement."}
          </Text>
        </View>
        <Text style={styles.small}>Identifiant du rendez-vous : {d.appointment_id}</Text>
        <Footer />
      </Page>
    </Document>
  );
}

/* ============ REPAIR SHEET ============ */

export interface RepairSheetInput {
  shop: Shop;
  logo_data_url?: string | null;
  repair_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  device_label: string;
  device_serial?: string | null;
  device_condition?: string | null;
  accessories?: string | null;
  customer_issue?: string | null;
  technical_diagnosis?: string | null;
  work_performed?: string | null;
  parts_used?: string | null;
  technician_name?: string | null;
  customer_visible_notes?: string | null;
  tracking_url?: string | null;
  qr_data_url?: string | null;
  is_intake_slip?: boolean; // true => bon de dépôt
}

function RepairDoc({ d }: { d: RepairSheetInput }) {
  const intake = !!d.is_intake_slip;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header
          title={intake ? "BON DE DÉPÔT" : "FICHE DE RÉPARATION"}
          shop={d.shop} logo_data_url={d.logo_data_url}
          ref_number={d.repair_number} date_iso={d.created_at}
        />
        <View style={styles.twoCol}>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Client</Text>
            <Text style={styles.strong}>{d.customer_name}</Text>
            {d.customer_phone && <Text>{d.customer_phone}</Text>}
          </View>
          <View style={[styles.col, styles.card]}>
            <Text style={styles.label}>Appareil</Text>
            <Text style={styles.strong}>{d.device_label}</Text>
            {d.device_serial && <Text>N° série : {d.device_serial}</Text>}
            {d.device_condition && <Text>État à la remise : {d.device_condition}</Text>}
            {d.accessories && <Text>Accessoires : {d.accessories}</Text>}
          </View>
        </View>

        {d.customer_issue && (
          <View style={[styles.card, styles.section]}>
            <Text style={styles.label}>Panne déclarée</Text>
            <Text>{d.customer_issue}</Text>
          </View>
        )}

        {!intake && (
          <>
            <View style={styles.tableHead}>
              <Text style={{ flex: 2 }}>Statut</Text>
              <Text style={{ flex: 3 }}>Dernière mise à jour</Text>
              <Text style={{ flex: 2 }}>Technicien</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={{ flex: 2 }}>{d.status}</Text>
              <Text style={{ flex: 3 }}>{fmtDate(d.updated_at, true)}</Text>
              <Text style={{ flex: 2 }}>{d.technician_name ?? "—"}</Text>
            </View>

            {d.technical_diagnosis && (
              <View style={[styles.card, styles.section, { marginTop: 10 }]}>
                <Text style={styles.label}>Diagnostic</Text>
                <Text>{d.technical_diagnosis}</Text>
              </View>
            )}
            {d.work_performed && (
              <View style={[styles.card, styles.section]}>
                <Text style={styles.label}>Travaux effectués</Text>
                <Text>{d.work_performed}</Text>
              </View>
            )}
            {d.parts_used && (
              <View style={[styles.card, styles.section]}>
                <Text style={styles.label}>Pièces</Text>
                <Text>{d.parts_used}</Text>
              </View>
            )}
            {d.customer_visible_notes && (
              <View style={[styles.card, styles.section]}>
                <Text style={styles.label}>Notes pour le client</Text>
                <Text>{d.customer_visible_notes}</Text>
              </View>
            )}
            {d.completed_at && (
              <Text style={styles.small}>Réparation clôturée le {fmtDate(d.completed_at, true)}.</Text>
            )}
          </>
        )}

        {intake && (
          <View style={[styles.card, styles.section]}>
            <Text style={styles.label}>Conditions de dépôt</Text>
            <Text style={styles.small}>
              Le matériel est déposé aux risques du client. La boutique décline toute
              responsabilité pour les données non sauvegardées. Un devis est établi avant
              toute intervention payante. Les appareils non récupérés dans un délai de
              90 jours après notification pourront être considérés comme abandonnés.
            </Text>
            <Text style={[styles.label, { marginTop: 10 }]}>Sauvegarde des données</Text>
            <Text style={styles.small}>
              Le client est informé qu'il lui appartient d'effectuer une sauvegarde de
              ses données avant toute intervention. La boutique met tout en œuvre pour
              préserver les données, sans obligation de résultat.
            </Text>
            <Text style={[styles.label, { marginTop: 14 }]}>Signature client</Text>
            <View style={{ height: 40, border: "1pt solid #e5e7eb", borderRadius: 3 }} />
          </View>
        )}

        {d.qr_data_url && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 }}>
            <Image src={d.qr_data_url} style={{ width: 80, height: 80 }} />
            <View>
              <Text style={styles.label}>Suivi en ligne</Text>
              {d.tracking_url && <Text style={styles.small}>{d.tracking_url}</Text>}
              <Text style={styles.small}>Dossier {d.repair_number}</Text>
            </View>
          </View>
        )}

        <Footer />
      </Page>
    </Document>
  );
}

/* ============ RENDER HELPERS ============ */

async function toBase64(instance: ReturnType<typeof pdf>): Promise<string> {
  const blob = await instance.toBlob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  const g = globalThis as any;
  if (typeof g.btoa === "function") return g.btoa(binary);
  return (g.Buffer as { from: (b: Uint8Array) => { toString: (fmt: string) => string } })
    .from(buf).toString("base64");
}

export async function renderReceiptPdfBase64(d: PaymentReceiptInput): Promise<string> {
  return toBase64(pdf(<ReceiptDoc d={d} />));
}
export async function renderAppointmentPdfBase64(d: AppointmentConfirmationInput): Promise<string> {
  return toBase64(pdf(<AppointmentDoc d={d} />));
}
export async function renderRepairPdfBase64(d: RepairSheetInput): Promise<string> {
  return toBase64(pdf(<RepairDoc d={d} />));
}