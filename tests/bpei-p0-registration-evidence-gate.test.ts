import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("../supabase/migrations/20261101080000_p0_signup_requires_verified_smtp_admin_legal.sql",import.meta.url),"utf8");

test("Opening public signup requires evidenced SMTP, confirmed administrators and reviewed legal release",()=>{
 for(const must of [
  "p0_registration_prerequisites_met","smtp_auth_delivery","legal_operator_review",
  "email_confirmed_at IS NOT NULL","u.deleted_at IS NULL","u.is_anonymous IS NOT TRUE",
  "bpei_legal_releases","count(DISTINCT d.kind)","bpei_registration_requires_p0_evidence",
  "independent_registration_enabled IS TRUE","RAISE EXCEPTION",
  "before_bpei_user_created","has_current_signup_acknowledgement"
 ]) assert.ok(sql.includes(must),must);
 assert.match(sql,/RETURN jsonb_build_object\('error',jsonb_build_object\(\s*'http_code',403/);
 assert.ok(sql.includes("bpei_admin_bootstrap"),"Privileged, unconfirmed first-admin provisioning must stay possible");
 assert.match(sql,/GRANT EXECUTE ON FUNCTION bpei_private.before_bpei_user_created\(jsonb\)\s+TO supabase_auth_admin/);
});

test("Signup gate cannot grant privileges, fake email confirmation, or publish legal docs",()=>{
 assert.doesNotMatch(sql,/INSERT INTO auth\.users|UPDATE auth\.users|INSERT INTO public\.independent_admins/i);
 assert.doesNotMatch(sql,/SET\s+email_confirmed_at\s*=|email_confirm\s*:\s*true/);
 assert.doesNotMatch(sql,/UPDATE public\.bpei_launch_controls/);
 assert.doesNotMatch(sql,/INSERT INTO public\.bpei_p0_attestations/);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION bpei_private.p0_registration_prerequisites_met\(text\) TO anon/);
});
