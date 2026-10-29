import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getFinanceStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string; from?: string; to?: string }) =>
    z.object({
      shopId: z.string().uuid(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const from = data.from ?? new Date(Date.now() - 30 * 86400000).toISOString();
    const to = data.to ?? new Date().toISOString();

    const [invoices, payments, quotes, creditNotes] = await Promise.all([
      context.supabase.from("invoices")
        .select("id, status, total_including_tax_cents, amount_paid_cents, amount_due_cents, issue_date, due_date, issued_at")
        .eq("shop_id", data.shopId)
        .gte("created_at", from).lte("created_at", to),
      context.supabase.from("payments")
        .select("amount_cents, method, paid_at")
        .eq("shop_id", data.shopId).eq("status", "confirmed")
        .gte("paid_at", from).lte("paid_at", to),
      context.supabase.from("quotes")
        .select("id, status, total_including_tax_cents, created_at")
        .eq("shop_id", data.shopId)
        .gte("created_at", from).lte("created_at", to),
      context.supabase.from("credit_notes")
        .select("total_including_tax_cents, status, created_at")
        .eq("shop_id", data.shopId).eq("status", "issued")
        .gte("created_at", from).lte("created_at", to),
    ]);

    const invs = invoices.data ?? [];
    const pays = payments.data ?? [];
    const qts = quotes.data ?? [];
    const cns = creditNotes.data ?? [];

    const now = new Date();
    const issued = invs.filter((i) => i.status !== "draft");
    const revenue_issued = issued.reduce((s, i) => s + (i.total_including_tax_cents ?? 0), 0);
    const revenue_collected = pays.reduce((s, p) => s + (p.amount_cents ?? 0), 0);
    const outstanding = issued.reduce((s, i) => s + (i.amount_due_cents ?? 0), 0);
    const invoices_paid = issued.filter((i) => i.status === "paid").length;
    const invoices_partial = issued.filter((i) => i.status === "partially_paid").length;
    const invoices_overdue = issued.filter(
      (i) => i.due_date && new Date(i.due_date) < now && (i.amount_due_cents ?? 0) > 0
    ).length;
    const avg_basket = issued.length ? Math.round(revenue_issued / issued.length) : 0;

    const quotes_sent = qts.filter((q) => q.status !== "draft").length;
    const quotes_accepted = qts.filter((q) => q.status === "accepted" || q.status === "converted").length;
    const acceptance_rate = quotes_sent ? Math.round((quotes_accepted / quotes_sent) * 100) : 0;

    const credit_notes_total = cns.reduce((s, c) => s + (c.total_including_tax_cents ?? 0), 0);

    const byMethod: Record<string, number> = {};
    for (const p of pays) byMethod[p.method] = (byMethod[p.method] ?? 0) + (p.amount_cents ?? 0);

    return {
      revenue_issued, revenue_collected, outstanding,
      invoices_issued: issued.length, invoices_paid, invoices_partial, invoices_overdue,
      avg_basket, quotes_sent, quotes_accepted, acceptance_rate,
      credit_notes_total, payments_by_method: byMethod,
    };
  });