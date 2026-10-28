// Authenticated client portal server functions.
// The customer must have a record in customer_portal_links (email match or accepted invite).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function linkedCustomers(supabase: any) {
  const { data, error } = await supabase.from("customer_portal_links").select("customer_id, shop_id");
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ customer_id: string; shop_id: string }>;
}

export const portalLinkAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("link_customer_records_for_user");
    if (error) throw new Error(error.message);
    return { linked: data as number };
  });

export const portalOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const links = await linkedCustomers(context.supabase);
    if (links.length === 0) return { links: [], shops: [], appointments: [], repairs: [], quotes: [], invoices: [], payments: [], reviews: [] };
    const customerIds = [...new Set(links.map((l) => l.customer_id))];
    const [appointments, repairs, quotes, invoices, payments, reviews, shops] = await Promise.all([
      context.supabase.from("appointments")
        .select("id, shop_id, starts_at, ends_at, status, service_id, technician_user_id")
        .in("customer_id", customerIds).order("starts_at", { ascending: false }).limit(50),
      context.supabase.from("repairs")
        .select("id, shop_id, repair_number, status, created_at, updated_at, customer_visible_notes, estimated_completion_at")
        .in("customer_id", customerIds).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("quotes")
        .select("id, shop_id, quote_number, status, total_including_tax_cents, currency, issue_date, valid_until")
        .in("customer_id", customerIds).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("invoices")
        .select("id, shop_id, invoice_number, status, total_including_tax_cents, amount_paid_cents, amount_due_cents, currency, issue_date, due_date")
        .in("customer_id", customerIds).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("payments")
        .select("id, shop_id, amount_cents, currency, method, status, paid_at, invoice_id")
        .in("customer_id", customerIds).order("paid_at", { ascending: false }).limit(50),
      context.supabase.from("reviews")
        .select("id, shop_id, rating, title, comment, status, created_at, replied_at, reply_text")
        .in("customer_id", customerIds).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("shops").select("id, name, city")
        .in("id", [...new Set(links.map((l) => l.shop_id))]),
    ]);
    return {
      links,
      shops: shops.data ?? [],
      appointments: appointments.data ?? [],
      repairs: repairs.data ?? [],
      quotes: quotes.data ?? [],
      invoices: invoices.data ?? [],
      payments: payments.data ?? [],
      reviews: reviews.data ?? [],
    };
  });