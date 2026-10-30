import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canAttemptNewMission,indicativeLevelForMissions,tierName} from "../src/lib/bpei-partner-levels.ts";
const read=(name:string)=>readFileSync(new URL("../supabase/migrations/"+name,import.meta.url),"utf8");
const files=[
 "20261029131257_national_partner_profiles_assessments_and_authorization.sql",
 "20261029131348_network_assessment_level_1_question_bank.sql",
 "20261029131401_network_assessment_level_2_question_bank.sql",
 "20261029131455_network_assessment_level_3_question_bank.sql",
 "20261029131503_network_assessment_level_4_question_bank.sql",
 "20261029131827_national_partner_prospect_registry_and_mission_compensation_offer.sql"
];
test("Four verified levels and promotion thresholds are indicative only",()=>{
 assert.deepEqual([1,2,3,4].map(tierName),["Junior","Confirmé","Expert","Master"]);
 assert.deepEqual([0,49,50,149,150,299,300].map(indicativeLevelForMissions),[1,1,2,2,3,3,4]);
 assert.equal(canAttemptNewMission({level:4,authorization_state:"candidate"}),false);
 assert.equal(canAttemptNewMission({level:4,authorization_state:"suspended"}),false);
 assert.equal(canAttemptNewMission({level:1,authorization_state:"active"}),true);
 assert.throws(()=>indicativeLevelForMissions(-1));
});
test("All 100 evaluation questions stay admin-only with answers in protected SQL table",()=>{
 const sql=read(files[0]);
 assert.match(sql,/bpei_assessment_questions_admin_read/);
 assert.match(sql,/evaluator_answer text NOT NULL/);
 assert.match(sql,/REVOKE ALL ON public\.bpei_assessment_questions FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/GRANT SELECT ON public\.bpei_assessment_questions TO anon/);
 for(let level=1;level<=4;level++){
  const bank=read(files[level]);
  const count=(bank.match(/\(\d+,\d+,/g)??[]).length;
  assert.equal(count,25,"level "+level+" must have 25 questions");
  assert.match(bank,/evaluator_answer/);
 }
});
test("Human scoring, professional verification and approval block unverified paid work",()=>{
 const sql=read(files[0]);
 for(const fragment of ["record_partner_assessment","set_partner_authorization",
   "Prior skills evaluation required","insurance_expires_on>=current_date",
   "enterprise_active IS TRUE","checked_at>=now()-interval '30 days'",
   "bpei_require_partner_level_on_missions","authorization_state='active'",
   "p_knowledge_score<12","p_practical_score<10","p_interview_score<4"])
  assert.ok(sql.includes(fragment),fragment);
 assert.match(sql,/SECURITY INVOKER/);
});
test("Prospecting enforces documented privacy basis, RLS, immutable ownership and duplicate detection",()=>{
 const sql=read(files[5]);
 for(const fragment of ["bpei_partner_leads_prevent_duplicate",
  "legal_basis","client_type='business' OR legal_basis<>'legitimate_interest'",
  "bpei_leads_read_scope","bpei_leads_insert_verified_legal_scope",
  "prevent_lead_identity_change","partner_id=(SELECT auth.uid())"])
  assert.ok(sql.includes(fragment),fragment);
});
test("Partner can decline or explicitly accept a documented HT remuneration before the mission",()=>{
 const sql=read(files[5]);
 for(const fragment of ["bpei_partner_compensation_proposals","p_technician_ht_cents+p_bpei_ht_cents<>p_client_price_ht_cents",
  "expense_policy","contractual_reference","respond_partner_compensation",
  "v_actor<>v_row.partner_id","bpei_require_transparent_compensation",
  "p.status='accepted'","No actual Stripe charge or payout"])
  assert.ok(sql.includes(fragment),fragment);
 assert.match(sql,/bpei_partner_compensation_private_read/);
 assert.match(sql,/SECURITY INVOKER/);
});
