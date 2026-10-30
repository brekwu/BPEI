import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261029135505_national_cross_region_partner_referrals_contractual_payment_terms.sql",import.meta.url),"utf8");
const admin=readFileSync(new URL("../src/components/admin/AdminReferralPanel.tsx",import.meta.url),"utf8");
const independent=readFileSync(new URL("../src/components/independent/PartnerReferralPanel.tsx",import.meta.url),"utf8");
test("A distinct professional referrer is verified and paid only from agreed BPEI HT share",()=>{
 for(const term of ["bpei_partner_referral_agreements","CHECK(referrer_id<>performing_partner_id)",
  "status='accepted' FOR UPDATE","source='referral'","p_fee_ht_cents>v_fee.bpei_ht_cents",
  "v.establishment_active=true","v.identity_confirmed=true",
  "enterprise_active=true","referrer_id","fee_basis","evidence_reference"])
  assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/api\.stripe\.com|transfer_data|sk_live_/);
});
test("Only BPEI admin proposes a referral and only the referring independent can accept it",()=>{
 for(const term of ["Administrator required",
  "respond_partner_referral","referrer_id=v_actor AND state='proposed'",
  "bpei_referral_private_read","SECURITY INVOKER","REVOKE ALL ON public.bpei_partner_referral_agreements"])
  assert.ok(sql.includes(term),term);
 assert.match(admin,/propose_partner_referral/);
 assert.match(independent,/respond_partner_referral/);
 assert.match(independent,/Aucun versement bancaire n'a été déclenché/);
});
