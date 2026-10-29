import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Bloc H1 — Garde serveur centralisé pour les modules sensibles.
 * À appeler AVANT toute écriture/action réelle sur un module marqué sensible.
 * Ne casse pas les modules `approved|active|production_ready`.
 * Journalise systématiquement les refus dans sensitive_module_access_log.
 */

export type SensitiveModuleCode =
  | "cash_register"
  | "ecommerce"
  | "commissions"
  | "missions"
  | "inter_shop_stock"
  | "exclusive_contracts"
  | "customer_signature"
  | "electronic_invoicing"
  | "sensitive_data_processing"
  | "professional_verification";

export type SensitiveAssertContext = {
  action: string;
  route?: string;
};

export class SensitiveModuleBlockedError extends Error {
  readonly code = "SENSITIVE_MODULE_BLOCKED";
  constructor(
    readonly moduleCode: string,
    readonly status: string,
    readonly reason: string,
    readonly blockers?: string,
  ) {
    super(`Module ${moduleCode} indisponible: ${reason}`);
  }
}

export async function assertSensitiveModuleAvailable(
  supabase: SupabaseClient<Database>,
  moduleCode: SensitiveModuleCode,
  ctx: SensitiveAssertContext,
): Promise<void> {
  const { data, error } = await supabase.rpc("assert_sensitive_module_available", {
    _module_code: moduleCode,
  });
  if (error) throw new Error(`Contrôle module ${moduleCode} impossible: ${error.message}`);
  const res = data as { allowed: boolean; status: string; reason: string | null; blockers: string | null };
  if (!res.allowed) {
    // Fire-and-forget audit; do not swallow the block
    void supabase.rpc("log_sensitive_module_denial", {
      _module_code: moduleCode,
      _action: ctx.action,
      _route: ctx.route ?? "",
      _reason: res.reason ?? "non autorisé",
      _status: res.status,
    });
    throw new SensitiveModuleBlockedError(
      moduleCode,
      res.status,
      res.reason ?? "non autorisé",
      res.blockers ?? undefined,
    );
  }
}