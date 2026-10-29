import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const sql=read("supabase/migrations/20261029142524_p0_verified_release_evidence_and_private_readiness_diagnostics.sql");
const admin=read("src/components/admin/AdminP0Readiness.tsx");
const bootstrap=read("scripts/p0-bootstrap-confirmed-admin.sql");
test("P0 launch status requires a genuine confirmed administrator and denies open access",()=>{
 for(const part of ["bpei_p0_attestations","ENABLE ROW LEVEL SECURITY",
  "REVOKE ALL ON public.bpei_p0_attestations FROM PUBLIC,anon,authenticated",
  "bpei_p0_attestations_admin_read",
  "u.email_confirmed_at IS NOT NULL","u.deleted_at IS NULL","u.is_anonymous IS NOT TRUE",
  "bpei_private.p0_readiness","BPEI administrator required",
  "SECURITY INVOKER","REVOKE ALL ON FUNCTION public.p0_readiness()"])
  assert.ok(sql.includes(part),part);
});
test("P0 records seven specific external evidence references and requires a real admin decision",()=>{
 for(const k of ["smtp_auth_delivery","commercial_sender_receipt","legal_operator_review",
  "partner_commission_signed","e_invoice_platform_receipt",
  "stripe_test_payment","full_pilot_verified"])
  assert.ok(sql.includes(k),k);
 for(const term of ["BETWEEN 30 AND 500","record_p0_attestation",
  "p_passed=false","DELETE FROM public.bpei_p0_attestations",
  "placeholder","à compléter","verified_by"])
  assert.ok(sql.includes(term),term);
});
test("P0 status cannot mark Stripe or full pilot ready without real DB evidence",()=>{
 for(const part of ["v_merchants>0","v_paid>0","v_invoices>0",
  "v_accepted_quotes>0","v_users>=2",
  "v_legal IS TRUE","v_mail IS TRUE","v_sender IS TRUE",
  "v_sent>0","'all_ready'","'mode','preproduction'"])
  assert.ok(sql.includes(part),part);
 assert.doesNotMatch(sql,/UPDATE public\.bpei_payment_controls|UPDATE public\.bpei_launch_controls/);
});
test("First administrator bootstrap never creates a fake user or auto-promotes an unconfirmed signup",()=>{
 for(const term of ["REPLACE_WITH_ACTUAL_CONFIRMED_BPEI_ADMIN_EMAIL",
   "email_confirmed_at IS NOT NULL","is_anonymous IS NOT TRUE",
   "SELECT count(*) FROM public.independent_admins",
   "INSERT INTO public.independent_admins"])
   assert.ok(bootstrap.includes(term),term);
 assert.doesNotMatch(bootstrap,/INSERT INTO auth\.users|mailer_autoconfirm|raw_user_meta_data/);
});
test("Admin UI shows real blocked status, preserves external secret privacy, never triggers release",()=>{
 assert.match(admin,/rpc\("p0_readiness"\)/);
 assert.match(admin,/rpc\("record_p0_attestation"/);
 assert.match(admin,/Il n'ouvre ni le recrutement public ni les paiements/);
 assert.doesNotMatch(admin,/rpc\("enable_live_checkout"/);
 const docs=["CONVENTION-PARTENAIRE-BPEI-BROUILLON.md","CGV-INTERVENTIONS-BPEI-BROUILLON.md"];
 for(const path of docs){
  const s=read("docs/juridique/"+path);
  assert.match(s,/PROJET|TRAME|NON SIGNÉ|NON PUBLIÉ/);
  assert.match(s,/\[À COMPLÉTER\]|\[IDENTITÉ/);
 }
});

test("CLI first administrator bootstrap refuses self-asserted email verification and never creates a fake user",()=>{
 const cli=read("scripts/p0-bootstrap-admin.mjs");
 for(const term of ["--user-id","auth.admin.getUserById","email_confirmed_at",
  "actor.is_anonymous===true","actor.deleted_at",
  "Bootstrap disabled: one or more administrators already exist",
  "from(\"independent_admins\").insert({user_id:userId})"])
  assert.ok(cli.includes(term),term);
 assert.doesNotMatch(cli,/email_confirm:\s*true|auth\.admin\.createUser|BPEI_ADMIN_EMAIL_VERIFIED/);
});
