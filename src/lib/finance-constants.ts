import type { Database } from "@/integrations/supabase/types";

export type QuoteStatus = Database["public"]["Enums"]["quote_status"];
export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type DocumentLineType = Database["public"]["Enums"]["document_line_type"];
export type TaxRegime = Database["public"]["Enums"]["tax_regime"];

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  viewed: "Consulté",
  accepted: "Accepté",
  refused: "Refusé",
  expired: "Expiré",
  cancelled: "Annulé",
  converted: "Converti en facture",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  issued: "Émise",
  sent: "Envoyée",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  overdue: "En retard",
  cancelled_by_credit_note: "Annulée par avoir",
  refunded: "Remboursée",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Espèces",
  card_terminal: "Terminal carte",
  bank_transfer: "Virement",
  cheque: "Chèque",
  online: "En ligne",
  pickup: "Paiement au retrait",
  manual_received: "Règlement manuel reçu",
  other: "Autre",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  failed: "Échec",
  cancelled: "Annulé",
  refunded: "Remboursé",
  partially_refunded: "Partiellement remboursé",
};

export const LINE_TYPE_LABEL: Record<DocumentLineType, string> = {
  service: "Prestation",
  product: "Produit",
  labour: "Main-d'œuvre",
  discount: "Remise",
  other: "Autre",
};

export const TAX_REGIME_LABEL: Record<TaxRegime, string> = {
  standard: "TVA normale",
  custom: "TVA personnalisée",
  exempt: "Exonération",
  franchise_base: "Franchise en base",
  not_applicable: "Non applicable",
};

export function quoteBadgeVariant(s: QuoteStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "accepted":
    case "converted":
      return "default";
    case "refused":
    case "cancelled":
    case "expired":
      return "destructive";
    case "sent":
    case "viewed":
      return "secondary";
    default:
      return "outline";
  }
}

export function invoiceBadgeVariant(s: InvoiceStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "paid":
      return "default";
    case "partially_paid":
    case "issued":
    case "sent":
      return "secondary";
    case "cancelled_by_credit_note":
    case "refunded":
    case "overdue":
      return "destructive";
    default:
      return "outline";
  }
}