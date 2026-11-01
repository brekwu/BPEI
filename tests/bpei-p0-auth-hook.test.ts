import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const config=readFileSync(new URL("../supabase/config.toml",import.meta.url),"utf8");
const sql=readFileSync(new URL("./p0-auth-hook-gate.sql",import.meta.url),"utf8");
const provision=readFileSync(new URL("../scripts/p0-provision-unconfirmed-admin.mjs",import.meta.url),"utf8");
const promote=readFileSync(new URL("../scripts/p0-bootstrap-admin.mjs",import.meta.url),"utf8");

test("BPEI signup hook is explicitly configured for local development",()=>{
 assert.match(config,/\[auth\.hook\.before_user_created\]/);
 assert.match(config,/enabled\s*=\s*true/);
 assert.match(config,/uri\s*=\s*"pg-functions:\/\/postgres\/bpei_private\/before_bpei_user_created"/);
 assert.match(config,/does NOT enable hooks on an existing/);
 assert.doesNotMatch(config,/service_role|secret_key\s*=|smtp_pass/i);
});

test("No anonymous user or user_metadata override can bypass closed registrations",()=>{
 assert.match(sql,/BEGIN READ ONLY;/);
 assert.match(sql,/ROLLBACK;/);
 assert.match(sql,/public_attempt/);
 assert.match(sql,/claimed_ack/);
 assert.match(sql,/fake_user_metadata_marker/);
 assert.match(sql,/authorized_bootstrap/);
 assert.match(sql,/public_attempt #>> '\{error,http_code\}' <> '403'/);
 assert.match(sql,/fake_user_metadata_marker #>> '\{error,http_code\}' <> '403'/);
 assert.match(sql,/has_function_privilege\('anon'.*'EXECUTE'\)/);
 assert.match(sql,/has_function_privilege\('authenticated'.*'EXECUTE'\)/);
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE)\s+(?:INTO\s+|FROM\s+|TABLE\s+)?(?:auth\.|public\.)/i);
});

test("Operator provisioning cannot force email confirmation or grant privileges",()=>{
 assert.match(provision,/email_confirm:false/);
 assert.match(provision,/bpei_admin_bootstrap:true/);
 assert.match(provision,/email_confirmed_at/);
 assert.doesNotMatch(provision,/email_confirm:true/);
 assert.doesNotMatch(provision,/\.insert\(\{user_id/);
 assert.match(promote,/actor\.email_confirmed_at/);
 assert.match(promote,/actor\.email\?\.toLowerCase\(\)!==email/);
 assert.match(promote,/app_metadata\?\.bpei_admin_bootstrap===true/);
});
