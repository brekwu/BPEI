import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listCreditNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("credit_notes")
      .select("*").eq("shop_id", data.shopId).order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const LineInput = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().min(0),
  unit_price_cents: z.number().int(),
  tax_rate: z.number().min(0).max(100).default(20),
  display_order: z.number().int().default(0),
});

export const createCreditNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; invoiceId: string; reason?: string | null;
    lines: z.input<typeof LineInput>[];
  }) => z.object({
    shopId: z.string().uuid(),
    invoiceId: z.string().uuid(),
    reason: z.string().max(1000).nullable().optional(),
    lines: z.array(LineInput).min(1),
  }).parse(i))
  .handler(async ({ data, context }) => {
    // Verify invoice is issued (not draft)
    const { data: inv } = await context.supabase.from("invoices")
      .select("id, status, customer_id, billing_identity_snapshot, customer_identity_snapshot, currency")
      .eq("id", data.invoiceId).eq("shop_id", data.shopId).maybeSingle();
    if (!inv) throw new Error("Facture introuvable");
    if (inv.status === "draft") throw new Error("La facture doit être émise");

    let sub = 0, tax = 0;
    const rows = data.lines.map((l, idx) => {
      const s = Math.round(l.quantity * l.unit_price_cents);
      const t = Math.round(s * (l.tax_rate / 100));
      sub += s; tax += t;
      return { ...l, line_subtotal_cents: s, line_tax_cents: t, line_total_cents: s + t, display_order: l.display_order ?? idx };
    });

    const { data: cn, error } = await context.supabase.from("credit_notes").insert({
      shop_id: data.shopId,
      invoice_id: data.invoiceId,
      customer_id: inv.customer_id,
      reason: data.reason ?? null,
      currency: inv.currency,
      subtotal_excluding_tax_cents: sub,
      tax_total_cents: tax,
      total_including_tax_cents: sub + tax,
      billing_identity_snapshot: inv.billing_identity_snapshot as any,
      customer_identity_snapshot: inv.customer_identity_snapshot as any,
      created_by: context.userId,
    }).select("*").maybeSingle();
    if (error) throw new Error(error.message);

    const { error: le } = await context.supabase.from("credit_note_lines").insert(
      rows.map((r) => ({ ...r, shop_id: data.shopId, credit_note_id: cn!.id }))
    );
    if (le) throw new Error(le.message);
    return cn!;
  });

export const issueCreditNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; creditNoteId: string }) =>
    z.object({ shopId: z.string().uuid(), creditNoteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: num, error } = await context.supabase.rpc("issue_credit_note", { _credit_note_id: data.creditNoteId });
    if (error) throw new Error(error.message);
    return { number: num as string };
  });

export const getCreditNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; creditNoteId: string }) =>
    z.object({ shopId: z.string().uuid(), creditNoteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [cn, lines] = await Promise.all([
      context.supabase.from("credit_notes").select("*").eq("id", data.creditNoteId).eq("shop_id", data.shopId).maybeSingle(),
      context.supabase.from("credit_note_lines").select("*").eq("credit_note_id", data.creditNoteId).order("display_order"),
    ]);
    if (cn.error) throw new Error(cn.error.message);
    return { creditNote: cn.data, lines: lines.data ?? [] };
  });