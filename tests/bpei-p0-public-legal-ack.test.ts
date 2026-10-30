import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const form=readFileSync(new URL("../src/components/public/BpeiIntakeForm.tsx",import.meta.url),"utf8");
const migration=readFileSync(new URL("../supabase/migrations/20261030114150_p0_refuse_stale_public_legal_consent.sql",import.meta.url),"utf8");

test("Public customer sends the displayed legal version, not an implicit database default",()=>{
 assert.ok(form.includes('if(availability!=="open"||!legalVersion)'),"Form must close without published version");
 assert.ok(form.includes('.insert({...checked.data,legal_version:legalVersion})'),"The submitted record must include the version the customer saw");
 assert.ok(form.includes("version {legalVersion}"),"The acknowledged version must be displayed");
});
test("Database trigger refuses a public request for a missing or stale legal version",()=>{
 assert.match(migration,/NEW\.legal_version IS NULL/);
 assert.match(migration,/v_actor IS NULL OR NOT EXISTS/);
 assert.match(migration,/NEW\.legal_version IS DISTINCT FROM v_version/);
 assert.match(migration,/USING ERRCODE='22023'/);
 assert.match(migration,/NEW\.consent_accepted IS DISTINCT FROM TRUE/);
});
test("Private administrator intake retains a verified exception",()=>{
 assert.match(migration,/public\.independent_admins a WHERE a\.user_id=v_actor/);
 assert.match(migration,/NEW\.legal_version := v_version/);
});
