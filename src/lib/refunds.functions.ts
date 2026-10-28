import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

export const refundSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    saleId: string;
    lines: Array<{ saleLineId: string; quantity: number; restock: "restock" | "damaged" | "not_returned" }>;
    refundMethod: "cash" | "card_terminal" | "bank_transfer" | "cheque" | "manual_received" | "other";
    reason?: string;
    reference?: string;
    idempotencyKey?: string;
  }) => z.object({
    saleId: uuid,
    lines: z.array(z.object({
      saleLineId: uuid,
      quantity: z.number().positive().max(9999),
      restock: z.enum(["restock", "damaged", "not_returned"]),
    })).min(1).max(200),
    refundMethod: z.enum(["cash", "card_terminal", "bank_transfer", "cheque", "manual_received", "other"]),
    reason: z.string().max(500).optional(),
    reference: z.string().max(120).optional(),
    idempotencyKey: z.string().min(1).max(120).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("refund_sale", {
      _sale_id: data.saleId,
      _lines: data.lines.map((l) => ({
        sale_line_id: l.saleLineId,
        quantity: l.quantity,
        restock: l.restock,
      })) as any,
      _refund_method: data.refundMethod,
      _reason: data.reason ?? undefined,
      _reference: data.reference ?? undefined,
      _idempotency_key: data.idempotencyKey ?? undefined,
    });
    if (error) throw new Error(error.message);
    return res as { credit_note_id: string; credit_note_number: string; refunded_amount_cents: number };
  });