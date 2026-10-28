import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";

const dir=dirname(fileURLToPath(import.meta.url));
const loader=join(dir,"p0-bootstrap-admin-mock-fetch.mjs");
const target=join(dir,"p0-bootstrap-admin.mjs");
const resumeId="a0000000-0000-4000-8000-000000000099";
const fakeEnv={
 BPEI_SUPABASE_URL:"https://qmbsfmcotnsxsvbigynz.supabase.co",
 BPEI_SUPABASE_SERVICE_KEY:"synthetic-service-key-no-real-access",
 BPEI_ADMIN_EMAIL:"p0-fixture-admin@example.invalid",
 BPEI_ADMIN_PASSWORD:"SyntheTic!Password2026",
 BPEI_ADMIN_EMAIL_VERIFIED:"true",
};
function run(scenario,{resume=false,overrides={}}={}){
 const args=["--import",loader,target,"--execute",...(resume?["--resume-user-id",resumeId]:[])];
 const env={...process.env,...fakeEnv,...overrides,BPEI_BOOTSTRAP_TEST_SCENARIO:scenario};
 // Disable any inherited node custom loaders. This test owns its preload.
 delete env.NODE_OPTIONS;
 const result=spawnSync(process.execPath,args,{env,encoding:"utf8",timeout:14000});
 if(result.error)throw result.error;
 const telemetry=result.stderr.match(/@@P0_MOCK@@(\{[^\n]+\})/);
 assert.ok(telemetry,"Isolated Supabase mock did not execute");
 const parsed=JSON.parse(telemetry[1]);
 const output=result.stdout+result.stderr.replace(/@@P0_MOCK@@[^\n]+/,"");
 return {status:result.status,events:parsed.events,marker:parsed.marker,output};
}
const assertNoNetwork=r=>assert.deepEqual(r.events,[]);
const assertSuccess=r=>{assert.equal(r.status,0,r.output);assert.match(r.output,/admin role verified and bootstrap marker removed/);};
const assertRejected=r=>{assert.notEqual(r.status,0);assert.match(r.output,/P0 bootstrap rejected/);};
function test(label,fn){try{fn();console.log("PASS "+label);}catch(error){console.error("FAIL "+label);throw error;}}
test("creates one synthetic administrator, verifies roster, removes bootstrap marker",()=>{
 const r=run("success");assertSuccess(r);
 assert.deepEqual(r.events,[
 "POST /auth/v1/admin/users","POST /rest/v1/independent_admins",
 "GET /rest/v1/independent_admins","GET /auth/v1/admin/users/"+resumeId,
 "PUT /auth/v1/admin/users/"+resumeId]);
 assert.equal(r.marker,false);
});
test("Auth creation rejection never grants a role",()=>{
 const r=run("create-error");assertRejected(r);
 assert.deepEqual(r.events,["POST /auth/v1/admin/users"]);
});
test("failed admin grant does not remove temporary bootstrap marker",()=>{
 const r=run("grant-error");assertRejected(r);
 assert.deepEqual(r.events,["POST /auth/v1/admin/users","POST /rest/v1/independent_admins"]);
 assert.equal(r.marker,true);
 assert.match(r.output,/--resume-user-id|Auth account created, but DB admin grant FAILED/);
});
test("failed roster readback does not falsely report success",()=>{
 const r=run("verify-error");assertRejected(r);
 assert.equal(r.events.some(e=>e.startsWith("PUT /auth/v1/admin/users")),false);
});
test("failed marker removal is not reported as success",()=>{
 const r=run("cleanup-error");assertRejected(r);
 assert.equal(r.marker,true);
});
test("resume skips user creation and can proceed without a password",()=>{
 const r=run("success",{resume:true,overrides:{BPEI_ADMIN_PASSWORD:""}});
 assertSuccess(r);
 assert.equal(r.events.some(e=>e==="POST /auth/v1/admin/users"),false);
 assert.equal(r.events[0],"GET /auth/v1/admin/users/"+resumeId);
});
test("resume rejects another email before granting administrator",()=>{
 const r=run("resume-wrong-email",{resume:true,overrides:{BPEI_ADMIN_PASSWORD:""}});
 assertRejected(r);
 assert.equal(r.events.some(e=>e==="POST /rest/v1/independent_admins"),false);
});
test("resume rejects an unconfirmed email before granting administrator",()=>{
 const r=run("resume-unconfirmed",{resume:true,overrides:{BPEI_ADMIN_PASSWORD:""}});
 assertRejected(r);
 assert.equal(r.events.some(e=>e==="POST /rest/v1/independent_admins"),false);
});
test("wrong project refused before a network call",()=>{
 const r=run("success",{overrides:{BPEI_SUPABASE_URL:"https://other-project.supabase.co"}});
 assertRejected(r);assertNoNetwork(r);
});
test("unverified email ownership refused before a network call",()=>{
 const r=run("success",{overrides:{BPEI_ADMIN_EMAIL_VERIFIED:"false"}});
 assertRejected(r);assertNoNetwork(r);
});
test("weak initial password refused before a network call",()=>{
 const r=run("success",{overrides:{BPEI_ADMIN_PASSWORD:"too-short"}});
 assertRejected(r);assertNoNetwork(r);
});
console.log("P0 bootstrap verified in isolated mock; no external requests issued.");
