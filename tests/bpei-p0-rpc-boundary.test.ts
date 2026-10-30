import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("./p0-core-rpc-boundary.sql",import.meta.url),"utf8");

test("P0 database non-admin smoke cannot write or leave session state behind",()=>{
 assert.match(sql,/BEGIN READ ONLY;/);
 assert.match(sql,/SET LOCAL ROLE authenticated;/);
 assert.match(sql,/ROLLBACK;/);
 assert.match(sql,/IF denied<>array_length\(calls,1\) OR other<>'' THEN/);
 assert.doesNotMatch(sql,/INSERT INTO|UPDATE public\.|DELETE FROM|CREATE USER|GRANT /i);
});

test("P0 rejects all eight privileged workflows for an unauthorised actor",()=>{
 for(const functionName of [
  "review_independent_application",
  "approve_bpei_legal_document",
  "publish_bpei_legal_documents",
  "mvp_create_quote",
  "mvp_issue_invoice_compliant",
  "mvp_test_checkout_readiness",
  "record_p0_attestation",
  "assign_bpei_inquiry"
 ])assert.ok(sql.includes("public."+functionName+"("),"Missing non-admin boundary: "+functionName);
 assert.match(sql,/WHEN insufficient_privilege THEN denied:=denied\+1/);
 assert.match(sql,/RAlSE EXCEPTION/imu.test(sql)?/AUTH FAILURE: unauthorized caller reached/:/AUTH FAILURE: unauthorized caller reached/);
});
