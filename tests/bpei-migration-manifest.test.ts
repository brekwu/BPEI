import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";

const migrations=readdirSync(new URL("../supabase/migrations/",import.meta.url))
 .filter(name=>name.endsWith(".sql")).sort();
const readme=readFileSync(new URL("../supabase/README.md",import.meta.url),"utf8");

test("Every applied Supabase migration is present exactly once in the repository",()=>{
 assert.equal(migrations.length,50,"50 applied migrations must be committed to GitHub");
 assert.equal(new Set(migrations.map(name=>name.slice(0,14))).size,50,
  "Supabase migration timestamps must be unique");
 assert.ok(migrations.every((name,index)=>index===0||name>migrations[index-1]),
  "Migration files must have monotonic names");
 assert.match(readme,/50 migrations appliquées/);
 assert.match(readme,/50 fichiers SQL versionnés/);
 assert.ok(migrations.some(name=>name==="20261028175736_p1_admin_roster_secure_cross_admin_visibility.sql"),
  "Admin roster RLS fix is required for other-admin assignment");
});
test("The admin roster migration enforces administrator isolation",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261028175736_p1_admin_roster_secure_cross_admin_visibility.sql",import.meta.url),"utf8");
 assert.match(sql,/bpei_private\.is_bpei_admin/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/p_user_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/independent_admin_read_roster/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
});

test("Mission foreign keys have covering indexes in the tracked P1 migration",()=>{
 const filename="20261028233020_p1_cover_mission_foreign_keys.sql";
 assert.ok(migrations.includes(filename),"Applied migration must be versioned using the Supabase timestamp");
 const sql=readFileSync(new URL("../supabase/migrations/"+filename,import.meta.url),"utf8");
 for(const [table,column] of [
  ["bpei_incident_events","actor_id"],
  ["bpei_mission_events","actor_id"],
  ["bpei_mission_incidents","reporter_id"],
  ["bpei_mission_incidents","reviewed_by"],
  ["bpei_notifications","incident_id"],
  ["bpei_notifications","mission_id"]
 ]){
  assert.match(sql,new RegExp("on\\s+public\\."+table+"\\s*\\(\\s*"+column+"\\s*\\)","i"),
    table+"."+column+" needs an index for FK lookups");
 }
});

test("Migrations commerciales : validation des coordonnées et numérotation atomique",()=>{
 const a=readFileSync(new URL("../supabase/migrations/20261029071010_mvp_customer_billing_contact_details.sql",import.meta.url),"utf8");
 assert.match(a,/bpei_intervention_billing_contact_required/);
 const q=readFileSync(new URL("../supabase/migrations/20261029071146_mvp_quotes_accepted_invoices_atomic_numbering.sql",import.meta.url),"utf8");
 for(const key of ["mvp_create_quote","mvp_accept_quote","mvp_issue_invoice","ON CONFLICT","ENABLE ROW LEVEL SECURITY","REVOKE ALL"])
  assert.ok(q.includes(key),key);
});

test("Issued invoices are immutable and counters remain private",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029071946_mvp_invoice_immutability_and_counter_privacy.sql",import.meta.url),"utf8");
 assert.match(sql,/bpei_invoice_immutable/);
 assert.match(sql,/bpei_invoice_counters_no_direct_read/);
 assert.match(sql,/BEFORE UPDATE OR DELETE/);
});

test("Test checkout is disabled by default and uses isolated provider-signed ledger",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029072951_mvp_test_stripe_connect_webhook_ledger_disabled.sql",import.meta.url),"utf8");
 for(const guard of ["test_checkout_enabled boolean NOT NULL DEFAULT false","test_enabled boolean NOT NULL DEFAULT false","mvp_test_checkout_prepare","mvp_test_checkout_attach","mvp_test_checkout_webhook","service_role","FOR UPDATE","Payment session, amount or merchant mismatch","bpei_payment_webhook_events"]){
  assert.ok(sql.includes(guard),guard);
 }
 assert.ok(!sql.includes("sk_test_"),"No provider keys may appear in SQL migrations");
});

test("Payment config, Stripe account mapping and event ledger stay inaccessible to clients",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029073330_mvp_private_stripe_configuration_explicit_denial.sql",import.meta.url),"utf8");
 for(const table of ["bpei_payment_controls","bpei_stripe_connected_accounts","bpei_payment_webhook_events"])
  assert.ok(sql.includes("ON public."+table),table);
 assert.match(sql,/TO anon,authenticated USING\(false\)/);
});

test("Manual admin intake requires publication, permission and verifiable privacy evidence",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029074253_mvp_private_administrator_phone_intake_with_consent_reference.sql",import.meta.url),"utf8");
 for(const fragment of [
  "bpei_private_intake_evidence","bpei_private_intake_admin_read",
  "legal_documents_published=true","p_privacy_ack_confirmed IS DISTINCT FROM true",
  "mvp_admin_create_inquiry","GRANT EXECUTE ON FUNCTION","consent_accepted"
 ])assert.ok(sql.includes(fragment),fragment);
 assert.ok(!sql.includes("UPDATE public.bpei_launch_controls SET"),
   "Manual intake must never activate legal publication");
});

test("Privileged manual client intake cannot run as public SECURITY DEFINER",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029074651_mvp_private_schema_for_privileged_manual_intake.sql",import.meta.url),"utf8");
 assert.match(sql,/SET SCHEMA bpei_private/);
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.mvp_admin_create_inquiry/);
});

test("Refund/dispute reports originate from signed Stripe TEST provider events only",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029075543_mvp_test_stripe_refund_dispute_reconciliation.sql",import.meta.url),"utf8");
 for(const key of ["bpei_payment_refunds","bpei_payment_disputes","bpei_payment_adjustment_events","mvp_test_payment_adjustment_event","p_account_id","p_payment_intent_id","p_amount_cents>v_attempt.amount_cents","service_role","ON CONFLICT"]){
  assert.ok(sql.includes(key),key);
 }
 assert.match(sql,/SECURITY INVOKER/);
});

test("Adjustment identity is immutable and Stripe intent has one owning merchant",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029080151_mvp_unique_payment_intent_and_immutable_adjustment_identity.sql",import.meta.url),"utf8");
 for(const s of ["UNIQUE INDEX bpei_payment_attempts_unique_merchant_intent","prevent_adjustment_reassignment","bpei_prevent_refund_reassignment","bpei_prevent_dispute_reassignment"])
  assert.ok(sql.includes(s),s);
});

test("Optional platform fee requires an explicit agreement and is zero by default",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029123512_mvp_optional_documented_connect_test_commission.sql",import.meta.url),"utf8");
 for(const term of ["DEFAULT 0","test_application_fee_bps","fee_agreement_reference","fee_agreement_at","application_fee_cents","mvp_test_checkout_prepare"])
  assert.ok(sql.includes(term),term);
});

test("The prelaunch transactional email outbox is private and cannot send by default",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029123952_mvp_commercial_email_outbox_disabled_by_default.sql",import.meta.url),"utf8");
 assert.match(sql,/UNIQUE\(kind,document_id\)/);
 assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
 assert.match(sql,/CREATE POLICY bpei_mail_outbox_admin_read/);
});

test("Incomplete invoice RPC is disabled and detailed issuer-specific payment terms are mandatory",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029125501_mvp_invoice_real_issuer_tax_and_payment_terms_without_legacy_bypass.sql",import.meta.url),"utf8");
 for(const part of ["mvp_issue_invoice_compliant","mvp_issue_invoice(p_quote_id","Old incomplete invoice issue path disabled",
  "issuer_vat_number","p_payment_terms","p_early_payment_discount","p_late_payment_penalties",
  "b2b_recovery_fee_cents","v_quote.vat_basis_points>0"])
  assert.ok(sql.includes(part),part);
 assert.match(sql,/SECURITY INVOKER/);
});
