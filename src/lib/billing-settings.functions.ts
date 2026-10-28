import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getBillingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { shopId: string }) => z.object({ shopId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("shop_billing_settings")
      .select("*").eq("shop_id", data.shopId).maybeSingle();
    return row;
  });

const Settings = z.object({
  shopId: z.string().uuid(),
  legal_name: z.string().max(200).nullable().optional(),
  trade_name: z.string().max(200).nullable().optional(),
  legal_form: z.string().max(100).nullable().optional(),
  billing_address: z.string().max(500).nullable().optional(),
  billing_city: z.string().max(100).nullable().optional(),
  billing_postal_code: z.string().max(20).nullable().optional(),
  billing_country: z.string().max(50).nullable().optional(),
  siren: z.string().max(20).nullable().optional(),
  siret: z.string().max(20).nullable().optional(),
  rcs: z.string().max(100).nullable().optional(),
  vat_number: z.string().max(30).nullable().optional(),
  tax_regime: z.enum(["standard", "custom", "exempt", "franchise_base", "not_applicable"]),
  default_tax_rate: z.number().min(0).max(100),
  currency: z.string().length(3),
  iban: z.string().max(40).nullable().optional(),
  bic: z.string().max(20).nullable().optional(),
  payment_terms: z.string().max(500).nullable().optional(),
  payment_due_days: z.number().int().min(0).max(365),
  late_penalty: z.string().max(200).nullable().optional(),
  fixed_recovery_indemnity: z.string().max(200).nullable().optional(),
  franchise_base_mention: z.string().max(500).nullable().optional(),
  quote_prefix: z.string().min(1).max(10),
  invoice_prefix: z.string().min(1).max(10),
  credit_note_prefix: z.string().min(1).max(10),
  default_quote_validity_days: z.number().int().min(1).max(365),
  default_deposit_percent: z.number().min(0).max(100),
  logo_url: z.string().max(500).nullable().optional(),
  footer_text: z.string().max(1000).nullable().optional(),
  extra_mentions: z.string().max(2000).nullable().optional(),
  purchase_price_variance_warning_pct: z.number().min(0).max(100).optional(),
  purchase_price_variance_warning_cents: z.number().int().min(0).optional(),
  purchase_price_variance_require_manager: z.boolean().optional(),
  accepts_card_in_store: z.boolean().optional(),
  accepts_cash: z.boolean().optional(),
  accepts_payment_on_pickup: z.boolean().optional(),
  accepts_bank_transfer: z.boolean().optional(),
  accepts_cheque: z.boolean().optional(),
  accepts_manual_payment: z.boolean().optional(),
  bank_account_holder: z.string().max(200).nullable().optional(),
  bank_transfer_instructions: z.string().max(2000).nullable().optional(),
  payment_preparation_delay: z.string().max(200).nullable().optional(),
});


export const upsertBillingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.input<typeof Settings>) => Settings.parse(i))
  .handler(async ({ data, context }) => {
    const { shopId, ...fields } = data;
    const { error } = await context.supabase.from("shop_billing_settings")
      .upsert({ shop_id: shopId, ...fields }, { onConflict: "shop_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export function billingSettingsMissing(s: any | null): string[] {
  if (!s) return [
    "Raison sociale", "Adresse de facturation", "SIREN", "Numéro de TVA",
    "Conditions de paiement", "IBAN",
  ];
  const missing: string[] = [];
  if (!s.legal_name) missing.push("Raison sociale");
  if (!s.billing_address) missing.push("Adresse");
  if (!s.siren) missing.push("SIREN");
  if (s.tax_regime === "standard" && !s.vat_number) missing.push("Numéro de TVA");
  if (!s.payment_terms) missing.push("Conditions de paiement");
  return missing;
}