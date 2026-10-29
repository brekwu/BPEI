import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SearchCategory =
  | "customers" | "devices" | "repairs" | "appointments"
  | "quotes" | "invoices" | "credit_notes" | "payments"
  | "stock" | "services" | "suppliers" | "purchase_orders";

export interface SearchResult {
  category: SearchCategory;
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  date?: string | null;
  amount_cents?: number | null;
  href: string;
}

const InputZ = z.object({
  shopId: z.string().uuid(),
  q: z.string().min(2).max(120),
  perCategory: z.number().int().min(1).max(10).optional(),
});

export const globalSearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof InputZ>) => InputZ.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const shopId = data.shopId;
    const limit = data.perCategory ?? 5;
    const q = data.q.trim();
    const like = `%${q}%`;
    const base = `/app/shop/${shopId}`;

    // Run all queries in parallel; RLS enforces isolation
    const [
      customers, devices, repairs, appointments,
      quotes, invoices, creditNotes, payments,
      stock, services, suppliers, pos,
    ] = await Promise.all([
      sb.from("customers")
        .select("id,customer_type,first_name,last_name,company_name,email,phone")
        .eq("shop_id", shopId)
        .or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(limit),
      sb.from("devices")
        .select("id,brand,model,serial_number,imei,device_type")
        .eq("shop_id", shopId)
        .or(`brand.ilike.${like},model.ilike.${like},serial_number.ilike.${like},imei.ilike.${like}`)
        .limit(limit),
      sb.from("repairs")
        .select("id,repair_number,status,customer_issue,created_at")
        .eq("shop_id", shopId)
        .or(`repair_number.ilike.${like},customer_issue.ilike.${like}`)
        .order("created_at", { ascending: false })
        .limit(limit),
      sb.from("appointments")
        .select("id,starts_at,status,contact_name,contact_phone,problem_description")
        .eq("shop_id", shopId)
        .or(`contact_name.ilike.${like},contact_phone.ilike.${like},problem_description.ilike.${like}`)
        .order("starts_at", { ascending: false })
        .limit(limit),
      sb.from("quotes")
        .select("id,quote_number,status,total_including_tax_cents,issue_date")
        .eq("shop_id", shopId)
        .ilike("quote_number", like)
        .limit(limit),
      sb.from("invoices")
        .select("id,invoice_number,status,total_including_tax_cents,issue_date")
        .eq("shop_id", shopId)
        .ilike("invoice_number", like)
        .limit(limit),
      sb.from("credit_notes")
        .select("id,credit_note_number,status,total_including_tax_cents,issue_date")
        .eq("shop_id", shopId)
        .ilike("credit_note_number", like)
        .limit(limit),
      sb.from("payments")
        .select("id,amount_cents,method,reference,paid_at")
        .eq("shop_id", shopId)
        .ilike("reference", like)
        .order("paid_at", { ascending: false })
        .limit(limit),
      sb.from("stock_items")
        .select("id,name,sku,barcode,brand,category,quantity")
        .eq("shop_id", shopId).is("archived_at", null)
        .or(`name.ilike.${like},sku.ilike.${like},barcode.ilike.${like},brand.ilike.${like}`)
        .limit(limit),
      sb.from("service_catalog")
        .select("id,name,category,unit_price_cents,active")
        .eq("shop_id", shopId)
        .or(`name.ilike.${like},category.ilike.${like}`)
        .limit(limit),
      sb.from("suppliers")
        .select("id,name,contact_name,email,phone")
        .eq("shop_id", shopId).is("archived_at", null)
        .or(`name.ilike.${like},contact_name.ilike.${like},email.ilike.${like}`)
        .limit(limit),
      sb.from("purchase_orders")
        .select("id,reference,status,total_ht_cents,order_date,supplier:suppliers(name)")
        .eq("shop_id", shopId)
        .ilike("reference", like)
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

    const results: SearchResult[] = [];

    (customers.data ?? []).forEach((c: any) => {
      const title = c.customer_type === "company"
        ? c.company_name ?? "Entreprise"
        : [c.first_name, c.last_name].filter(Boolean).join(" ") || "Client";
      results.push({
        category: "customers", id: c.id, title,
        subtitle: c.email ?? c.phone ?? null,
        href: `${base}/clients/${c.id}`,
      });
    });
    (devices.data ?? []).forEach((d: any) => results.push({
      category: "devices", id: d.id,
      title: [d.brand, d.model].filter(Boolean).join(" ") || "Appareil",
      subtitle: d.serial_number ?? d.imei ?? d.device_type,
      href: `${base}/devices/${d.id}`,
    }));
    (repairs.data ?? []).forEach((r: any) => results.push({
      category: "repairs", id: r.id,
      title: r.repair_number ?? "Réparation",
      subtitle: r.customer_issue ?? null,
      status: r.status, date: r.created_at,
      href: `${base}/repairs/${r.id}`,
    }));
    (appointments.data ?? []).forEach((a: any) => results.push({
      category: "appointments", id: a.id,
      title: a.contact_name ?? "Rendez-vous",
      subtitle: a.problem_description ?? a.contact_phone,
      status: a.status, date: a.starts_at,
      href: `${base}/appointments`,
    }));
    (quotes.data ?? []).forEach((x: any) => results.push({
      category: "quotes", id: x.id, title: x.quote_number ?? "Devis",
      status: x.status, date: x.issue_date, amount_cents: x.total_including_tax_cents,
      href: `${base}/quotes/${x.id}`,
    }));
    (invoices.data ?? []).forEach((x: any) => results.push({
      category: "invoices", id: x.id, title: x.invoice_number ?? "Facture",
      status: x.status, date: x.issue_date, amount_cents: x.total_including_tax_cents,
      href: `${base}/invoices/${x.id}`,
    }));
    (creditNotes.data ?? []).forEach((x: any) => results.push({
      category: "credit_notes", id: x.id, title: x.credit_note_number ?? "Avoir",
      status: x.status, date: x.issue_date, amount_cents: x.total_including_tax_cents,
      href: `${base}/credit-notes`,
    }));
    (payments.data ?? []).forEach((p: any) => results.push({
      category: "payments", id: p.id, title: p.reference ?? "Paiement",
      subtitle: p.method, date: p.paid_at, amount_cents: p.amount_cents,
      href: `${base}/payments`,
    }));
    (stock.data ?? []).forEach((s: any) => results.push({
      category: "stock", id: s.id, title: s.name,
      subtitle: [s.sku, s.brand, s.category].filter(Boolean).join(" · ") || null,
      href: `${base}/stock`,
    }));
    (services.data ?? []).forEach((sv: any) => results.push({
      category: "services", id: sv.id, title: sv.name,
      subtitle: sv.category, amount_cents: sv.unit_price_cents,
      href: `${base}/catalog`,
    }));
    (suppliers.data ?? []).forEach((sp: any) => results.push({
      category: "suppliers", id: sp.id, title: sp.name,
      subtitle: sp.contact_name ?? sp.email ?? sp.phone,
      href: `${base}/purchasing/suppliers/${sp.id}`,
    }));
    (pos.data ?? []).forEach((po: any) => results.push({
      category: "purchase_orders", id: po.id, title: po.reference,
      subtitle: po.supplier?.name ?? null,
      status: po.status, date: po.order_date, amount_cents: po.total_ht_cents,
      href: `${base}/purchasing`,
    }));

    return results;
  });

// ============================================================================
// Paginated single-category search (used by the full search page)
// ============================================================================

const CatInputZ = z.object({
  shopId: z.string().uuid(),
  q: z.string().min(2).max(120),
  category: z.enum([
    "customers", "devices", "repairs", "appointments",
    "quotes", "invoices", "credit_notes", "payments",
    "stock", "services", "suppliers", "purchase_orders",
  ]),
  offset: z.number().int().min(0).max(1000).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export interface CategorySearchResponse {
  rows: SearchResult[];
  total: number;
}

export const searchCategory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof CatInputZ>) => CatInputZ.parse(i))
  .handler(async ({ data, context }): Promise<CategorySearchResponse> => {
    const sb = context.supabase;
    const { shopId, category } = data;
    const q = data.q.trim();
    const like = `%${q}%`;
    const offset = data.offset ?? 0;
    const limit = data.limit ?? 20;
    const to = offset + limit - 1;
    const base = `/app/shop/${shopId}`;

    const rows: SearchResult[] = [];
    let total = 0;

    switch (category) {
      case "customers": {
        const { data: d, count } = await sb.from("customers")
          .select("id,customer_type,first_name,last_name,company_name,email,phone", { count: "exact" })
          .eq("shop_id", shopId)
          .or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .order("created_at", { ascending: false })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((c: any) => rows.push({
          category, id: c.id,
          title: c.customer_type === "company"
            ? c.company_name ?? "Entreprise"
            : [c.first_name, c.last_name].filter(Boolean).join(" ") || "Client",
          subtitle: c.email ?? c.phone ?? null,
          href: `${base}/clients/${c.id}`,
        }));
        break;
      }
      case "devices": {
        const { data: d, count } = await sb.from("devices")
          .select("id,brand,model,serial_number,imei,device_type", { count: "exact" })
          .eq("shop_id", shopId)
          .or(`brand.ilike.${like},model.ilike.${like},serial_number.ilike.${like},imei.ilike.${like}`)
          .order("created_at", { ascending: false })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((x: any) => rows.push({
          category, id: x.id,
          title: [x.brand, x.model].filter(Boolean).join(" ") || "Appareil",
          subtitle: x.serial_number ?? x.imei ?? x.device_type,
          href: `${base}/devices/${x.id}`,
        }));
        break;
      }
      case "repairs": {
        const { data: d, count } = await sb.from("repairs")
          .select("id,repair_number,status,customer_issue,created_at", { count: "exact" })
          .eq("shop_id", shopId)
          .or(`repair_number.ilike.${like},customer_issue.ilike.${like}`)
          .order("created_at", { ascending: false })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((x: any) => rows.push({
          category, id: x.id,
          title: x.repair_number ?? "Réparation",
          subtitle: x.customer_issue ?? null,
          status: x.status, date: x.created_at,
          href: `${base}/repairs/${x.id}`,
        }));
        break;
      }
      case "appointments": {
        const { data: d, count } = await sb.from("appointments")
          .select("id,starts_at,status,contact_name,contact_phone,problem_description", { count: "exact" })
          .eq("shop_id", shopId)
          .or(`contact_name.ilike.${like},contact_phone.ilike.${like},problem_description.ilike.${like}`)
          .order("starts_at", { ascending: false })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((x: any) => rows.push({
          category, id: x.id,
          title: x.contact_name ?? "Rendez-vous",
          subtitle: x.problem_description ?? x.contact_phone,
          status: x.status, date: x.starts_at,
          href: `${base}/appointments`,
        }));
        break;
      }
      case "quotes": {
        const { data: d, count } = await sb.from("quotes")
          .select("id,quote_number,status,total_including_tax_cents,issue_date", { count: "exact" })
          .eq("shop_id", shopId).ilike("quote_number", like)
          .order("issue_date", { ascending: false })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((x: any) => rows.push({
          category, id: x.id, title: x.quote_number ?? "Devis",
          status: x.status, date: x.issue_date, amount_cents: x.total_including_tax_cents,
          href: `${base}/quotes/${x.id}`,
        }));
        break;
      }
      case "invoices": {
        const { data: d, count } = await sb.from("invoices")
          .select("id,invoice_number,status,total_including_tax_cents,issue_date", { count: "exact" })
          .eq("shop_id", shopId).ilike("invoice_number", like)
          .order("issue_date", { ascending: false })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((x: any) => rows.push({
          category, id: x.id, title: x.invoice_number ?? "Facture",
          status: x.status, date: x.issue_date, amount_cents: x.total_including_tax_cents,
          href: `${base}/invoices/${x.id}`,
        }));
        break;
      }
      case "credit_notes": {
        const { data: d, count } = await sb.from("credit_notes")
          .select("id,credit_note_number,status,total_including_tax_cents,issue_date", { count: "exact" })
          .eq("shop_id", shopId).ilike("credit_note_number", like)
          .order("issue_date", { ascending: false })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((x: any) => rows.push({
          category, id: x.id, title: x.credit_note_number ?? "Avoir",
          status: x.status, date: x.issue_date, amount_cents: x.total_including_tax_cents,
          href: `${base}/credit-notes`,
        }));
        break;
      }
      case "payments": {
        const { data: d, count } = await sb.from("payments")
          .select("id,amount_cents,method,reference,paid_at", { count: "exact" })
          .eq("shop_id", shopId).ilike("reference", like)
          .order("paid_at", { ascending: false })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((p: any) => rows.push({
          category, id: p.id, title: p.reference ?? "Paiement",
          subtitle: p.method, date: p.paid_at, amount_cents: p.amount_cents,
          href: `${base}/payments`,
        }));
        break;
      }
      case "stock": {
        const { data: d, count } = await sb.from("stock_items")
          .select("id,name,sku,barcode,brand,category,quantity", { count: "exact" })
          .eq("shop_id", shopId).is("archived_at", null)
          .or(`name.ilike.${like},sku.ilike.${like},barcode.ilike.${like},brand.ilike.${like}`)
          .order("name", { ascending: true })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((s: any) => rows.push({
          category, id: s.id, title: s.name,
          subtitle: [s.sku, s.brand, s.category].filter(Boolean).join(" · ") || null,
          href: `${base}/stock`,
        }));
        break;
      }
      case "services": {
        const { data: d, count } = await sb.from("service_catalog")
          .select("id,name,category,unit_price_cents", { count: "exact" })
          .eq("shop_id", shopId)
          .or(`name.ilike.${like},category.ilike.${like}`)
          .order("name", { ascending: true })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((sv: any) => rows.push({
          category, id: sv.id, title: sv.name,
          subtitle: sv.category, amount_cents: sv.unit_price_cents,
          href: `${base}/catalog`,
        }));
        break;
      }
      case "suppliers": {
        const { data: d, count } = await sb.from("suppliers")
          .select("id,name,contact_name,email,phone", { count: "exact" })
          .eq("shop_id", shopId).is("archived_at", null)
          .or(`name.ilike.${like},contact_name.ilike.${like},email.ilike.${like}`)
          .order("name", { ascending: true })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((sp: any) => rows.push({
          category, id: sp.id, title: sp.name,
          subtitle: sp.contact_name ?? sp.email ?? sp.phone,
          href: `${base}/purchasing/suppliers/${sp.id}`,
        }));
        break;
      }
      case "purchase_orders": {
        const { data: d, count } = await sb.from("purchase_orders")
          .select("id,reference,status,total_ht_cents,order_date,supplier:suppliers(name)", { count: "exact" })
          .eq("shop_id", shopId).ilike("reference", like)
          .order("created_at", { ascending: false })
          .range(offset, to);
        total = count ?? 0;
        (d ?? []).forEach((po: any) => rows.push({
          category, id: po.id, title: po.reference,
          subtitle: po.supplier?.name ?? null,
          status: po.status, date: po.order_date, amount_cents: po.total_ht_cents,
          href: `${base}/purchasing`,
        }));
        break;
      }
    }

    return { rows, total };
  });