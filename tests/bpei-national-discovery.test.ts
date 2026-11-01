import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const migrations=[
 "20261029132434_national_lead_trusted_origin_and_client_category_immutability.sql",
 "20261029132619_national_public_partner_discovery_opt_in_verified_capabilities.sql",
 "20261029132717_national_search_safe_public_definer_without_private_schema_usage.sql",
 "20261029132803_national_discovery_invoker_scoped_private_schema_access.sql"
];
test("Prospects cannot impersonate BPEI or referral and customer category is immutable",()=>{
 const sql=read("supabase/migrations/"+migrations[0]);
 assert.match(sql,/source='partner'/);
 assert.match(sql,/public\.independent_admins/);
 assert.match(sql,/NEW\.client_type IS DISTINCT FROM OLD\.client_type/);
 assert.match(sql,/NEW\.legal_basis IS DISTINCT FROM OLD\.legal_basis/);
});
test("Public search never displays unapproved, unqualified or non-consenting technicians",()=>{
 const sql=read("supabase/migrations/"+migrations[1]);
 for(const gate of [
 "public_listing_opt_in boolean NOT NULL DEFAULT false",
 "p.public_listing_opt_in=true",
 "t.authorization_state='active'",
 "c.insurance_expires_on>=current_date",
 "a.status='approved'",
 "p.verified_at IS NOT NULL",
 "c.checked_at>=now()-interval '30 days'",
 "bpei_legal_acceptances",
 "bpei_verified_partner_skills",
 "LIMIT 20",
 "p.remote_available=true"
 ])assert.ok(sql.includes(gate),gate);
 assert.doesNotMatch(sql,/customer_email|client_phone|stripe_account_id|insurance_evidence_reference/);
});
test("Skill approval requires admin and the public directory returns only redacted details",()=>{
 const sql=read("supabase/migrations/"+migrations[1]);
 assert.match(sql,/verify_partner_skill/);
 assert.match(sql,/Administrator required/);
 assert.match(sql,/Candidate must be evaluated first/);
 assert.match(sql,/RETURNS TABLE\(/);
 assert.match(sql,/display_name text,city text,postal_code text,level smallint/);
 const route=read("src/routes/trouver-un-technicien.tsx");
 assert.match(route,/review_summary_for_public/);
 assert.match(route,/Aucun partenaire BPEI vérifié/);
 assert.doesNotMatch(route,/prestataire disponible immédiatement/);
});
test("Safe anonymous RPC exposes no privileged public SECURITY DEFINER function",()=>{
 const hardening=read("supabase/migrations/"+migrations[3]);
 assert.match(hardening,/SECURITY INVOKER/);
 assert.match(hardening,/GRANT USAGE ON SCHEMA bpei_private TO anon/);
 assert.match(hardening,/ALTER DEFAULT PRIVILEGES IN SCHEMA bpei_private REVOKE EXECUTE/);
 assert.match(hardening,/REVOKE EXECUTE ON FUNCTION/);
});
