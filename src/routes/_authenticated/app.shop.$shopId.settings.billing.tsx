import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { getBillingSettings, upsertBillingSettings, billingSettingsMissing } from "@/lib/billing-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TAX_REGIME_LABEL } from "@/lib/finance-constants";
import { BillingSettingsBanner } from "@/components/shop/BillingSettingsBanner";
import { canManageShop } from "@/lib/shop-constants";
import { ShopLogoUpload } from "@/components/shop/ShopLogoUpload";
import {
  PageContainer, PageHeader, SectionCard, FormRow, FormActions, Skeleton,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/settings/billing")({
  head: () => ({ meta: [{ title: "Paramètres de facturation — BPEI" }] }),
  component: BillingSettingsPage,
});

const EMPTY = {
  legal_name: "", trade_name: "", legal_form: "",
  billing_address: "", billing_city: "", billing_postal_code: "", billing_country: "FR",
  siren: "", siret: "", rcs: "", vat_number: "",
  tax_regime: "standard" as const, default_tax_rate: 20, currency: "EUR",
  iban: "", bic: "", payment_terms: "", payment_due_days: 30,
  late_penalty: "", fixed_recovery_indemnity: "", franchise_base_mention: "",
  quote_prefix: "DEV", invoice_prefix: "FAC", credit_note_prefix: "AVO",
  default_quote_validity_days: 30, default_deposit_percent: 0,
  logo_url: "", footer_text: "", extra_mentions: "",
  accepts_card_in_store: false, accepts_cash: false, accepts_payment_on_pickup: false,
  accepts_bank_transfer: false, accepts_cheque: false, accepts_manual_payment: false,
  bank_account_holder: "", bank_transfer_instructions: "", payment_preparation_delay: "",
};

function BillingSettingsPage() {
  const ctx = useShop();
  const qc = useQueryClient();
  const canManage = canManageShop(ctx.role);
  const getFn = useServerFn(getBillingSettings);
  const upsertFn = useServerFn(upsertBillingSettings);

  const q = useQuery({
    queryKey: ["billing-settings", ctx.shopId],
    queryFn: () => getFn({ data: { shopId: ctx.shopId } }),
  });
  const [f, setF] = useState<any>(EMPTY);
  useEffect(() => { if (q.data) setF({ ...EMPTY, ...q.data }); }, [q.data]);

  const save = useMutation({
    mutationFn: () => {
      const { logo_url: _ignored, ...rest } = f;
      return upsertFn({ data: { shopId: ctx.shopId, ...rest, logo_url: q.data?.logo_url ?? null } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["billing-settings", ctx.shopId] }); toast.success("Enregistré"); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const missing = billingSettingsMissing(q.data);

  function bind<K extends keyof typeof EMPTY>(k: K) {
    return { value: (f[k] ?? "") as any, onChange: (e: any) => setF({ ...f, [k]: e.target.value }) };
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Paramètres"
        title="Facturation"
        description="Identité légale, TVA et mentions figurant sur les documents."
      />

      {missing.length > 0 && <BillingSettingsBanner missing={missing} shopId={ctx.shopId} />}

      {q.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <fieldset disabled={!canManage} className="space-y-6">
          <SectionCard title="Identité légale">
            <FormRow className="lg:grid-cols-3">
              <Field label="Raison sociale"><Input {...bind("legal_name")} /></Field>
              <Field label="Nom commercial"><Input {...bind("trade_name")} /></Field>
              <Field label="Forme juridique"><Input {...bind("legal_form")} /></Field>
              <Field label="SIREN"><Input {...bind("siren")} /></Field>
              <Field label="SIRET"><Input {...bind("siret")} /></Field>
              <Field label="RCS / RNE"><Input {...bind("rcs")} /></Field>
              <Field label="Numéro de TVA"><Input {...bind("vat_number")} /></Field>
              <Field label="Régime de TVA">
                <Select value={f.tax_regime} onValueChange={(v) => setF({ ...f, tax_regime: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TAX_REGIME_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Taux TVA par défaut (%)">
                <Input type="number" step="0.01" value={f.default_tax_rate}
                  onChange={(e) => setF({ ...f, default_tax_rate: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Devise"><Input {...bind("currency")} /></Field>
            </FormRow>
          </SectionCard>

          <SectionCard title="Adresse de facturation">
            <FormRow>
              <Field label="Adresse"><Textarea rows={3} {...bind("billing_address")} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code postal"><Input {...bind("billing_postal_code")} /></Field>
                <Field label="Ville"><Input {...bind("billing_city")} /></Field>
                <Field label="Pays" className="col-span-2"><Input {...bind("billing_country")} /></Field>
              </div>
            </FormRow>
          </SectionCard>

          <SectionCard title="Paiement">
            <FormRow>
              <Field label="IBAN"><Input {...bind("iban")} /></Field>
              <Field label="BIC"><Input {...bind("bic")} /></Field>
              <Field label="Délai de paiement (jours)">
                <Input type="number" value={f.payment_due_days}
                  onChange={(e) => setF({ ...f, payment_due_days: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="% d'acompte par défaut">
                <Input type="number" step="0.01" value={f.default_deposit_percent}
                  onChange={(e) => setF({ ...f, default_deposit_percent: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Conditions de paiement"><Textarea rows={2} {...bind("payment_terms")} /></Field>
              <Field label="Pénalités de retard"><Textarea rows={2} {...bind("late_penalty")} /></Field>
              <Field label="Indemnité forfaitaire (pros)"><Textarea rows={2} {...bind("fixed_recovery_indemnity")} /></Field>
              <Field label="Mention franchise en base"><Textarea rows={2} {...bind("franchise_base_mention")} /></Field>
            </FormRow>
          </SectionCard>

          <SectionCard title="Moyens de paiement acceptés" description="Ces informations s'affichent sur la fiche boutique publique. L'IBAN n'est jamais publié.">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["accepts_card_in_store", "Carte bancaire en boutique"],
                ["accepts_cash", "Espèces"],
                ["accepts_payment_on_pickup", "Paiement au retrait"],
                ["accepts_bank_transfer", "Virement bancaire"],
                ["accepts_cheque", "Chèque"],
                ["accepts_manual_payment", "Paiement déjà encaissé manuellement"],
              ].map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={!!f[k]}
                    onChange={(e) => setF({ ...f, [k]: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            {f.accepts_bank_transfer && (
              <div className="mt-4 space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-900">
                  Coordonnées bancaires — usage interne uniquement. Elles ne seront JAMAIS affichées sur la fiche publique.
                </p>
                <FormRow>
                  <Field label="Titulaire du compte"><Input {...bind("bank_account_holder")} /></Field>
                  <Field label="IBAN"><Input {...bind("iban")} /></Field>
                  <Field label="BIC (facultatif)"><Input {...bind("bic")} /></Field>
                </FormRow>
                <Field label="Instructions de virement (référence à indiquer, etc.)">
                  <Textarea rows={3} {...bind("bank_transfer_instructions")} />
                </Field>
              </div>
            )}
            <div className="mt-4">
              <Field label="Délai de préparation du paiement (ex : « 24 à 48 h après réception »)">
                <Input {...bind("payment_preparation_delay")} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Numérotation & mise en forme">
            <FormRow className="lg:grid-cols-3">
              <Field label="Préfixe devis"><Input {...bind("quote_prefix")} /></Field>
              <Field label="Préfixe factures"><Input {...bind("invoice_prefix")} /></Field>
              <Field label="Préfixe avoirs"><Input {...bind("credit_note_prefix")} /></Field>
              <Field label="Validité devis par défaut (jours)">
                <Input type="number" value={f.default_quote_validity_days}
                  onChange={(e) => setF({ ...f, default_quote_validity_days: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Pied de page"><Textarea rows={2} {...bind("footer_text")} /></Field>
              <Field label="Mentions complémentaires"><Textarea rows={2} {...bind("extra_mentions")} /></Field>
            </FormRow>
          </SectionCard>

          <SectionCard title="Logo boutique" description="Utilisé sur les documents et les pages publiques.">
            <ShopLogoUpload shopId={ctx.shopId} canManage={canManage} />
          </SectionCard>

          {canManage && (
            <FormActions sticky>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </FormActions>
          )}
        </fieldset>
      )}
    </PageContainer>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}