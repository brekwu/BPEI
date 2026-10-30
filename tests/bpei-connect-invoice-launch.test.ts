import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
test("Accounts v2 Connect integration cannot run without TEST credentials and professional eligibility",()=>{
 const src=readFileSync(new URL("../supabase/functions/bpei-test-connect/index.ts",import.meta.url),"utf8");
 for(const guard of ["BPEI_TEST_CONNECT_ENABLED","sk_test_","/v2/core/accounts",
  "/v2/core/account_links","2026-09-30.endive","legal_documents_published",
  "independent_verification_checks","insurance_confirmed","insurance_expires_on",
  "bpei_legal_acceptances","independent_applications","email_confirmed_at",
  "providerReady","charges_enabled","payouts_enabled","details_submitted","test_enabled:false"])
  assert.ok(src.includes(guard),guard);
 assert.doesNotMatch(src,/sk_live_/);
 assert.doesNotMatch(src,/type:\s*["']express["']/,"New Stripe account creation should use Accounts v2");
});
test("Test Connect never trusts merchant identifiers from ordinary users or bypasses admin review",()=>{
 const src=readFileSync(new URL("../supabase/functions/bpei-test-connect/index.ts",import.meta.url),"utf8");
 assert.ok(src.includes('payload.action==="approve"&&!isAdmin'));
 assert.ok(src.includes('payload.action==="admin_list"'));
 assert.ok(src.includes("user.id"));
 assert.ok(src.includes('payload.action==="approve"?payload.issuer_id:user.id'));
 assert.ok(src.includes('!isAdmin)return answer(403'));
 assert.ok(src.includes("test_enabled:true"));
 assert.ok(src.includes("test_enabled:false"));
 assert.ok(src.includes("Stripe collects real company details directly"));
});
test("Business invoice cannot be generated through legacy path or without actual legal terms",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029125501_mvp_invoice_real_issuer_tax_and_payment_terms_without_legacy_bypass.sql",import.meta.url),"utf8");
 for(const k of ["Old incomplete invoice issue path disabled","mvp_issue_invoice_compliant",
  "issuer_vat_number","p_issuer_vat_number","p_payment_terms",
  "p_late_payment_penalties","p_early_payment_discount",
  "b2b_recovery_fee_cents","4000","invoice_number"])
  assert.ok(sql.includes(k),k);
 const desk=readFileSync(new URL("../src/components/admin/AdminCommercialDesk.tsx",import.meta.url),"utf8");
 assert.ok(desk.includes('rpc("mvp_issue_invoice_compliant"'));
 assert.doesNotMatch(desk,/rpc\("mvp_issue_invoice",/);
 assert.ok(desk.includes("paymentTerms.trim().length<10"));
});
test("Draft legal documents are not marked as approved, published or legally verified",()=>{
 for(const p of ["MENTIONS-LEGALES-BPEI-BROUILLON.md","CONFIDENTIALITE-BPEI-BROUILLON.md","CGU-BPEI-BROUILLON.md"]){
  const text=readFileSync(new URL("../docs/juridique/"+p,import.meta.url),"utf8");
  assert.match(text,/PROJET|BROUILLON|NE PAS PUBLIER|NON PUBLIÉ/);
  assert.match(text,/\[.*\]/);
 }
});
