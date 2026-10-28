// Central money helpers. All amounts stored as integer cents.

export function toCents(amount: number | string | null | undefined): number {
  if (amount === null || amount === undefined || amount === "") return 0;
  const n = typeof amount === "string" ? Number(amount.replace(",", ".")) : amount;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return (cents ?? 0) / 100;
}

export function formatMoney(cents: number, currency = "EUR", locale = "fr-FR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format((cents ?? 0) / 100);
}

export function formatDate(input: string | Date | null | undefined, locale = "fr-FR"): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(input: string | Date | null | undefined, locale = "fr-FR"): string {
  if (!input) return "—";
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function computeLine({
  quantity, unit_price_cents, discount_percent, tax_rate,
}: {
  quantity: number; unit_price_cents: number;
  discount_percent: number; tax_rate: number;
}) {
  const gross = quantity * unit_price_cents;
  const subtotal = Math.round(gross * (1 - (discount_percent ?? 0) / 100));
  const tax = Math.round(subtotal * ((tax_rate ?? 0) / 100));
  return { subtotal, tax, total: subtotal + tax };
}