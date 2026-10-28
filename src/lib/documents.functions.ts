import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Build the DocumentInput and render the PDF for an invoice. */
export const getInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; invoiceId: string }) =>
    z.object({ shopId: z.string().uuid(), invoiceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [invRes, linesRes] = await Promise.all([
      context.supabase.from("invoices").select("*").eq("id", data.invoiceId).eq("shop_id", data.shopId).maybeSingle(),
      context.supabase.from("invoice_lines").select("*").eq("invoice_id", data.invoiceId).order("display_order"),
    ]);
    if (invRes.error) throw new Error(invRes.error.message);
    if (!invRes.data) throw new Error("Facture introuvable");
    const inv: any = invRes.data;
    const bill = (inv.billing_identity_snapshot as any) ?? {};
    const cust = (inv.customer_identity_snapshot as any) ?? null;
    const shop = bill.shop ?? {};
    const settings = bill.settings ?? null;

    const { renderDocumentPdfBase64 } = await import("./pdf/documents.server");
    const { loadLogoDataUrl } = await import("./pdf/logo-loader.server");
    const logo_data_url = await loadLogoDataUrl(settings?.logo_url ?? null);
    const base64 = await renderDocumentPdfBase64({
      kind: "invoice",
      number: inv.invoice_number ?? "BROUILLON",
      issue_date: inv.issue_date,
      due_or_valid_date: inv.due_date,
      currency: inv.currency ?? "EUR",
      shop: { name: shop.name, address: shop.address, city: shop.city, postal_code: shop.postal_code, country: shop.country, email: shop.email, phone: shop.phone },
      billing_settings: settings,
      customer: cust ? {
        name: cust.customer_type === "business" ? cust.company_name : `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim(),
        address: cust.address, city: cust.city, postal_code: cust.postal_code, country: cust.country,
        email: cust.email, phone: cust.phone, siret: cust.siret, vat_number: cust.vat_number,
      } : null,
      lines: (linesRes.data ?? []).map((l: any) => ({
        description: l.description, quantity: Number(l.quantity), unit: l.unit,
        unit_price_cents: l.unit_price_cents, discount_percent: Number(l.discount_percent),
        tax_rate: Number(l.tax_rate),
      })),
      subtotal_cents: inv.subtotal_excluding_tax_cents ?? 0,
      discount_cents: inv.discount_total_cents ?? 0,
      tax_cents: inv.tax_total_cents ?? 0,
      total_cents: inv.total_including_tax_cents ?? 0,
      amount_paid_cents: inv.amount_paid_cents,
      amount_due_cents: inv.amount_due_cents,
      customer_message: inv.customer_message,
      legal_mentions: inv.legal_mentions_snapshot,
      payment_terms: inv.payment_terms_snapshot,
      logo_data_url,
    });
    return { base64, filename: `${inv.invoice_number ?? "brouillon"}.pdf` };
  });

export const getQuotePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; quoteId: string }) =>
    z.object({ shopId: z.string().uuid(), quoteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [qRes, linesRes] = await Promise.all([
      context.supabase.from("quotes").select("*").eq("id", data.quoteId).eq("shop_id", data.shopId).maybeSingle(),
      context.supabase.from("quote_lines").select("*").eq("quote_id", data.quoteId).order("display_order"),
    ]);
    if (qRes.error) throw new Error(qRes.error.message);
    if (!qRes.data) throw new Error("Devis introuvable");
    const q: any = qRes.data;
    const bill = (q.billing_identity_snapshot as any) ?? {};
    const cust = (q.customer_identity_snapshot as any) ?? null;
    const shop = bill.shop ?? {};
    const settings = bill.settings ?? null;

    const { renderDocumentPdfBase64 } = await import("./pdf/documents.server");
    const { loadLogoDataUrl } = await import("./pdf/logo-loader.server");
    const logo_data_url = await loadLogoDataUrl(settings?.logo_url ?? null);
    const base64 = await renderDocumentPdfBase64({
      kind: "quote",
      number: q.quote_number ?? "BROUILLON",
      issue_date: q.issue_date,
      due_or_valid_date: q.valid_until,
      currency: q.currency ?? "EUR",
      shop: { name: shop.name, address: shop.address, city: shop.city, postal_code: shop.postal_code, country: shop.country, email: shop.email, phone: shop.phone },
      billing_settings: settings,
      customer: cust ? {
        name: cust.customer_type === "business" ? cust.company_name : `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim(),
        address: cust.address, city: cust.city, postal_code: cust.postal_code, country: cust.country,
        email: cust.email, phone: cust.phone, siret: cust.siret, vat_number: cust.vat_number,
      } : null,
      lines: (linesRes.data ?? []).map((l: any) => ({
        description: l.description, quantity: Number(l.quantity), unit: l.unit,
        unit_price_cents: l.unit_price_cents, discount_percent: Number(l.discount_percent),
        tax_rate: Number(l.tax_rate),
      })),
      subtotal_cents: q.subtotal_excluding_tax_cents ?? 0,
      discount_cents: q.discount_total_cents ?? 0,
      tax_cents: q.tax_total_cents ?? 0,
      total_cents: q.total_including_tax_cents ?? 0,
      customer_message: q.customer_message,
      legal_mentions: q.terms_snapshot,
      payment_terms: null,
      logo_data_url,
    });
    return { base64, filename: `${q.quote_number ?? "brouillon"}.pdf` };
  });