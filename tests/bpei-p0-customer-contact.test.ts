import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const migration=readFileSync(new URL("../supabase/migrations/20261030100238_p0_validate_customer_contact_before_intake.sql",import.meta.url),"utf8");
const smoke=readFileSync(new URL("./p0-customer-contact-gate.sql",import.meta.url),"utf8");

test("Admin-only customer intake verifies e-mail and telephone on the server",()=>{
 for(const required of [
  "bpei_private.valid_customer_contact(p_email,p_phone)",
  "CREATE OR REPLACE FUNCTION bpei_private.valid_customer_contact",
  "BETWEEN 5 AND 254",
  "BETWEEN 6 AND 15",
  "REVOKE ALL ON FUNCTION bpei_private.valid_customer_contact(text,text) FROM PUBLIC,anon,authenticated"
 ])assert.ok(migration.includes(required),"Missing customer-contact server rule: "+required);
});

test("Customer contact gate is 12-case, read-only and exercises the actual SQL function",()=>{
 assert.match(smoke,/BEGIN READ ONLY;/);
 assert.match(smoke,/ROLLBACK;/);
 assert.match(smoke,/bpei_private\.valid_customer_contact\(email,phone\)/);
 assert.match(smoke,/IF bad_count<>0 THEN RAISE EXCEPTION/);
 assert.match(smoke,/has_function_privilege\('anon'/);
 assert.match(smoke,/has_function_privilege\('authenticated'/);
 assert.equal((smoke.match(/\('[^']*','[^']*',(true|false)\)/g)||[]).length,12);
 assert.doesNotMatch(smoke,/\b(?:INSERT INTO|UPDATE public\.|DELETE FROM|CREATE USER|GRANT )\b/i);
});
