import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=(f:string)=>readFileSync(new URL("../"+f,import.meta.url),"utf8");
test("Stripe TEST Checkout refuses invoices not exactly backed by a signed independent compensation split",()=>{
 const sql=get("supabase/migrations/20261029140639_strict_stripe_test_checkout_invoice_compensation_reconciliation.sql");
 for(const required of [
  "mvp_test_checkout_prepare","legal_documents_published","test_checkout_enabled",
  "bpei_partner_compensation_proposals","p.status='accepted'",
  "p.accepted_at IS NOT NULL","r.status='completed'",
  "v_invoice.client_price_ht_cents::bigint <> v_invoice.net_cents",
  "v_invoice.technician_ht_cents::bigint+v_invoice.bpei_ht_cents::bigint<>v_invoice.net_cents",
  "v_invoice.fee_agreement_reference","v_invoice.contractual_reference",
  "v_fee<>v_invoice.bpei_ht_cents","bpei_partner_referral_agreements",
  "a.state='accepted'","v_invoice.vat_basis_points <> 0",
  "test_application_fee_bps","((v_invoice.gross_cents::bigint*2500+5000)/10000)"
 ])assert.ok(sql.includes(required),required);
 assert.doesNotMatch(sql,/sk_live_/);
});
test("Admin-only readiness returns actionable reasons without generating transactions or exposing Stripe secrets",()=>{
 const source=get("supabase/migrations/20261029140800_admin_test_checkout_readiness_reconciliation_explanations.sql");
 const fix=get("supabase/migrations/20261029140847_checkout_readiness_typed_optional_rows.sql");
 const component=get("src/components/admin/AdminTestCheckoutReadiness.tsx");
 for(const required of [
  "mvp_test_checkout_readiness","Administrator required",
  "Documents juridiques BPEI non publiés","Paiement Stripe TEST désactivé",
  "Devis sans acceptation vérifiable","Intervention effectivement terminée",
  "Rémunération HT non acceptée","Le partage contractuel HT",
  "Frais Stripe TEST différents","Compte marchand Stripe TEST non vérifié",
  "Un Checkout test existe déjà"
 ])assert.ok(source.includes(required),required);
 for(const required of [
  "v_mission public.independent_requests%ROWTYPE",
  "v_terms public.bpei_partner_compensation_proposals%ROWTYPE",
  "v_merchant public.bpei_stripe_connected_accounts%ROWTYPE",
  "SELECT r.* INTO v_mission","SELECT p.* INTO v_terms","SELECT m.* INTO v_merchant"
 ])assert.ok(fix.includes(required),required);
 assert.doesNotMatch(source,/INSERT INTO public.bpei_payment_attempts/);
 assert.match(component,/mvp_test_checkout_readiness/);
 assert.match(component,/Il ne crée aucun paiement/);
 assert.ok(get("src/components/admin/AdminCommercialDesk.tsx").includes("<AdminTestCheckoutReadiness invoiceId={invoice.id}/>"));
});
