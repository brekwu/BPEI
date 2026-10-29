import { Badge } from "@/components/ui/badge";
import {
  QUOTE_STATUS_LABEL, INVOICE_STATUS_LABEL,
  quoteBadgeVariant, invoiceBadgeVariant,
  type QuoteStatus, type InvoiceStatus,
} from "@/lib/finance-constants";

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge variant={quoteBadgeVariant(status)}>{QUOTE_STATUS_LABEL[status]}</Badge>;
}
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={invoiceBadgeVariant(status)}>{INVOICE_STATUS_LABEL[status]}</Badge>;
}