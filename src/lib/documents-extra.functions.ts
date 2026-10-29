/**
 * Server functions for extended PDF exports (credit notes, receipts,
 * appointment confirmations, repair sheets / intake slips).
 * Each function respects RLS through the authenticated Supabase client
 * from `requireSupabaseAuth`. Logo is snapshot-based when available
 * (invoices / quotes / credit_notes) or live-fetched for operational
 * artefacts (appointments / repairs).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

async function makeQrDataUrl(text: string): Promise<string | null> {
  try {
    const QR = await import("qrcode");
    const dataUrl = await QR.toDataURL(text, { margin: 1, width: 240 });
    return dataUrl;
  } catch (e) {
    console.warn("[qr] generation failed", e);
    return null;
  }
}

/* ============ CREDIT NOTE (AVOIR) ============ */

export const getCreditNotePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; creditNoteId: string }) =>
    z.object({ shopId: uuid, creditNoteId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const [cnRes, linesRes] = await Promise.all([
      context.supabase.from("credit_notes").select("*")
        .eq("id", data.creditNoteId).eq("shop_id", data.shopId).maybeSingle(),
      context.supabase.from("credit_note_lines").select("*")
        .eq("credit_note_id", data.creditNoteId).order("display_order"),
    ]);
    if (cnRes.error) throw new Error(cnRes.error.message);
    if (!cnRes.data) throw new Error("Avoir introuvable");
    const cn: any = cnRes.data;
    const bill = (cn.billing_identity_snapshot as any) ?? {};
    const cust = (cn.customer_identity_snapshot as any) ?? null;
    const shop = bill.shop ?? {};
    const settings = bill.settings ?? null;

    const { renderDocumentPdfBase64 } = await import("./pdf/documents.server");
    const { loadLogoDataUrl } = await import("./pdf/logo-loader.server");
    const logo_data_url = await loadLogoDataUrl(settings?.logo_url ?? null);
    // Récupère la facture liée pour afficher son numéro
    const invRef = await context.supabase.from("invoices")
      .select("invoice_number").eq("id", cn.invoice_id).maybeSingle();
    const linkedInvoice = invRef.data?.invoice_number ?? null;

    const base64 = await renderDocumentPdfBase64({
      kind: "credit_note",
      number: cn.credit_note_number ?? "BROUILLON",
      issue_date: cn.issue_date ?? cn.created_at,
      due_or_valid_date: cn.issue_date ?? null,
      currency: cn.currency ?? "EUR",
      shop: { name: shop.name, address: shop.address, city: shop.city, postal_code: shop.postal_code, country: shop.country, email: shop.email, phone: shop.phone },
      billing_settings: settings,
      customer: cust ? {
        name: cust.customer_type === "business" ? cust.company_name : `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim(),
        address: cust.address, city: cust.city, postal_code: cust.postal_code, country: cust.country,
        email: cust.email, phone: cust.phone, siret: cust.siret, vat_number: cust.vat_number,
      } : null,
      lines: (linesRes.data ?? []).map((l: any) => ({
        description: l.description, quantity: Number(l.quantity), unit: l.unit,
        unit_price_cents: l.unit_price_cents, discount_percent: Number(l.discount_percent ?? 0),
        tax_rate: Number(l.tax_rate),
      })),
      subtotal_cents: cn.subtotal_excluding_tax_cents,
      discount_cents: 0,
      tax_cents: cn.tax_total_cents,
      total_cents: cn.total_including_tax_cents,
      customer_message: cn.reason
        ? `Motif de l'avoir : ${cn.reason}${linkedInvoice ? `\nFacture liée : ${linkedInvoice}` : ""}`
        : linkedInvoice ? `Facture liée : ${linkedInvoice}` : null,
      legal_mentions: cn.legal_mentions_snapshot,
      payment_terms: null,
      logo_data_url,
    });
    return { base64, filename: `${cn.credit_note_number ?? "avoir-brouillon"}.pdf` };
  });

/* ============ PAYMENT RECEIPT ============ */

export const getPaymentReceiptPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; paymentId: string }) =>
    z.object({ shopId: uuid, paymentId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: pay, error } = await context.supabase
      .from("payments").select("*")
      .eq("id", data.paymentId).eq("shop_id", data.shopId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!pay) throw new Error("Paiement introuvable");

    const [invRes, custRes, bsRes] = await Promise.all([
      pay.invoice_id
        ? context.supabase.from("invoices")
            .select("invoice_number, total_including_tax_cents, amount_paid_cents, amount_due_cents, billing_identity_snapshot")
            .eq("id", pay.invoice_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      pay.customer_id
        ? context.supabase.from("customers")
            .select("customer_type, company_name, first_name, last_name")
            .eq("id", pay.customer_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      context.supabase.from("shop_billing_settings")
        .select("logo_url, legal_name, billing_address, billing_city, billing_postal_code, billing_country, siret, vat_number, extra_mentions")
        .eq("shop_id", data.shopId).maybeSingle(),
    ]);

    const inv: any = invRes.data;
    const cust: any = custRes.data;
    const settings: any = bsRes.data ?? {};
    // On privilégie le snapshot facture si disponible ; sinon settings courants
    const bill = (inv?.billing_identity_snapshot as any) ?? { settings, shop: {} };
    const shop = bill.shop ?? {};
    const activeSettings = bill.settings ?? settings;

    const { renderReceiptPdfBase64 } = await import("./pdf/operational-documents.server");
    const { loadLogoDataUrl } = await import("./pdf/logo-loader.server");
    const logo_data_url = await loadLogoDataUrl(activeSettings?.logo_url ?? null);
    const customer_name = cust
      ? (cust.customer_type === "business"
          ? cust.company_name
          : `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim())
      : null;

    const base64 = await renderReceiptPdfBase64({
      shop: {
        name: shop.name ?? activeSettings?.legal_name ?? null,
        address: shop.address ?? activeSettings?.billing_address ?? null,
        city: shop.city ?? activeSettings?.billing_city ?? null,
        postal_code: shop.postal_code ?? activeSettings?.billing_postal_code ?? null,
        country: shop.country ?? activeSettings?.billing_country ?? null,
        siret: activeSettings?.siret ?? null,
        vat_number: activeSettings?.vat_number ?? null,
      },
      logo_data_url,
      receipt_number: `REC-${pay.id.slice(0, 8).toUpperCase()}`,
      invoice_number: inv?.invoice_number ?? null,
      paid_at: pay.paid_at,
      method: pay.method,
      reference: pay.reference,
      amount_cents: pay.amount_cents,
      currency: pay.currency ?? "EUR",
      customer_name,
      invoice_total_cents: inv?.total_including_tax_cents ?? null,
      invoice_paid_cents: inv?.amount_paid_cents ?? null,
      invoice_due_cents: inv?.amount_due_cents ?? null,
      legal_mentions: activeSettings?.extra_mentions ?? null,
    });
    return { base64, filename: `recu-${pay.id.slice(0, 8)}.pdf` };
  });

/* ============ APPOINTMENT CONFIRMATION ============ */

export const getAppointmentConfirmationPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; appointmentId: string }) =>
    z.object({ shopId: uuid, appointmentId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: appt, error } = await context.supabase
      .from("appointments").select("*")
      .eq("id", data.appointmentId).eq("shop_id", data.shopId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!appt) throw new Error("Rendez-vous introuvable");

    const [shopRes, bsRes, svcRes, techRes] = await Promise.all([
      context.supabase.from("shops")
        .select("name, address, city, postal_code, phone, email")
        .eq("id", data.shopId).maybeSingle(),
      context.supabase.from("shop_billing_settings")
        .select("logo_url, siret, vat_number")
        .eq("shop_id", data.shopId).maybeSingle(),
      appt.service_id
        ? context.supabase.from("service_catalog").select("name").eq("id", appt.service_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      appt.technician_user_id
        ? context.supabase.from("profiles").select("first_name, last_name").eq("id", appt.technician_user_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    const shop: any = shopRes.data ?? {};
    const bs: any = bsRes.data ?? {};
    const { renderAppointmentPdfBase64 } = await import("./pdf/operational-documents.server");
    const { loadLogoDataUrl } = await import("./pdf/logo-loader.server");
    const logo_data_url = await loadLogoDataUrl(bs.logo_url ?? null);

    const startsAt = new Date(appt.starts_at);
    const endsAt = new Date(appt.ends_at);
    const duration = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);

    const tech: any = techRes.data;
    const technician_name = tech ? `${tech.first_name ?? ""} ${tech.last_name ?? ""}`.trim() || null : null;

    const base64 = await renderAppointmentPdfBase64({
      shop: {
        name: shop.name, address: shop.address, city: shop.city,
        postal_code: shop.postal_code, phone: shop.phone, email: shop.email,
        siret: bs.siret, vat_number: bs.vat_number,
      },
      logo_data_url,
      appointment_id: appt.id,
      service_name: svcRes.data?.name ?? null,
      starts_at: appt.starts_at,
      ends_at: appt.ends_at,
      duration_minutes: duration,
      customer_name: appt.contact_name ?? "Client",
      customer_phone: appt.contact_phone,
      customer_email: appt.contact_email,
      technician_name,
      device_description: appt.device_description,
      problem_description: appt.problem_description,
      cancellation_policy: null,
    });
    return { base64, filename: `rdv-${appt.id.slice(0, 8)}.pdf` };
  });

/* ============ REPAIR SHEET / INTAKE SLIP ============ */

export const getRepairPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; repairId: string; kind: "sheet" | "intake" }) =>
    z.object({ shopId: uuid, repairId: uuid, kind: z.enum(["sheet", "intake"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rep, error } = await context.supabase
      .from("repairs").select("*")
      .eq("id", data.repairId).eq("shop_id", data.shopId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!rep) throw new Error("Réparation introuvable");

    const [shopRes, bsRes, custRes, devRes, techRes, tokenRes] = await Promise.all([
      context.supabase.from("shops").select("name, address, city, postal_code, phone, email").eq("id", data.shopId).maybeSingle(),
      context.supabase.from("shop_billing_settings").select("logo_url, siret, vat_number").eq("shop_id", data.shopId).maybeSingle(),
      rep.customer_id
        ? context.supabase.from("customers")
            .select("customer_type, company_name, first_name, last_name, phone")
            .eq("id", rep.customer_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      rep.device_id
        ? context.supabase.from("devices")
            .select("device_type, brand, model, serial_number, imei")
            .eq("id", rep.device_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      rep.assigned_technician_id
        ? context.supabase.from("profiles").select("first_name, last_name").eq("id", rep.assigned_technician_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      context.supabase.rpc("get_or_create_repair_token", { _repair_id: rep.id }),
    ]);

    const shop: any = shopRes.data ?? {};
    const bs: any = bsRes.data ?? {};
    const cust: any = custRes.data;
    const dev: any = devRes.data;
    const tech: any = techRes.data;
    const token: string | null = (tokenRes.data as any) ?? null;

    const { renderRepairPdfBase64 } = await import("./pdf/operational-documents.server");
    const { loadLogoDataUrl } = await import("./pdf/logo-loader.server");
    const logo_data_url = await loadLogoDataUrl(bs.logo_url ?? null);

    const origin = process.env.PUBLIC_APP_ORIGIN ?? "https://bpei.fr";
    const tracking_url = token ? `${origin}/suivi/${token}` : null;
    const qr_data_url = tracking_url ? await makeQrDataUrl(tracking_url) : null;

    const customer_name = cust
      ? (cust.customer_type === "business"
          ? cust.company_name
          : `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim())
      : "Client";
    const device_label = dev
      ? [dev.brand, dev.model, dev.device_type].filter(Boolean).join(" ")
      : "Appareil";
    const technician_name = tech ? `${tech.first_name ?? ""} ${tech.last_name ?? ""}`.trim() || null : null;

    const base64 = await renderRepairPdfBase64({
      shop: {
        name: shop.name, address: shop.address, city: shop.city,
        postal_code: shop.postal_code, phone: shop.phone, email: shop.email,
        siret: bs.siret, vat_number: bs.vat_number,
      },
      logo_data_url,
      repair_number: rep.repair_number ?? "—",
      status: rep.status,
      created_at: rep.created_at,
      updated_at: rep.updated_at,
      completed_at: rep.completed_at,
      customer_name,
      customer_phone: cust?.phone ?? null,
      device_label,
      device_serial: dev?.serial_number ?? dev?.imei ?? null,
      device_condition: rep.initial_condition ?? null,
      accessories: null,
      customer_issue: rep.customer_issue,
      technical_diagnosis: data.kind === "sheet" ? rep.technical_diagnosis : null,
      work_performed: data.kind === "sheet" ? rep.work_performed ?? null : null,
      parts_used: null,
      technician_name,
      // Notes visibles client uniquement (jamais les notes internes)
      customer_visible_notes: data.kind === "sheet" ? rep.customer_visible_notes : null,
      tracking_url,
      qr_data_url,
      is_intake_slip: data.kind === "intake",
    });
    const prefix = data.kind === "intake" ? "bon-depot" : "fiche-reparation";
    return { base64, filename: `${prefix}-${rep.repair_number ?? rep.id.slice(0, 8)}.pdf` };
  });