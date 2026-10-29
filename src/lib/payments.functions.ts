import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("payments")
      .select("*").eq("shop_id", data.shopId)
      .order("paid_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    shopId: string; invoiceId: string; amount_cents: number;
    method: "cash" | "card_terminal" | "bank_transfer" | "cheque" | "online" | "other";
    reference?: string | null; paid_at?: string | null; notes?: string | null;
  }) => z.object({
    shopId: z.string().uuid(),
    invoiceId: z.string().uuid(),
    amount_cents: z.number().int().positive(),
    method: z.enum(["cash", "card_terminal", "bank_transfer", "cheque", "online", "other"]),
    reference: z.string().max(200).nullable().optional(),
    paid_at: z.string().nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    // Prevent overpayment silently
    const { data: inv } = await context.supabase.from("invoices").select("amount_due_cents, shop_id")
      .eq("id", data.invoiceId).eq("shop_id", data.shopId).maybeSingle();
    if (!inv) throw new Error("Facture introuvable");
    if (data.amount_cents > inv.amount_due_cents) {
      throw new Error(`Montant supérieur au solde restant (${(inv.amount_due_cents / 100).toFixed(2)} €).`);
    }
    const { data: pid, error } = await context.supabase.rpc("record_payment", {
      _invoice_id: data.invoiceId,
      _amount_cents: data.amount_cents,
      _method: data.method,
      _reference: data.reference ?? undefined,
      _paid_at: data.paid_at ?? new Date().toISOString(),
      _notes: data.notes ?? undefined,
    });
    if (error) throw new Error(error.message);
    return { id: pid as string };
  });