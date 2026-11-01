import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {bpeiSupabaseDependencyAvailable} from "../src/lib/bpei-dependency-health.ts";

const key="sb_publishable_"+"p".repeat(30);
const url="https://bpei-synthetic.supabase.co";
const closed={id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null};
const open={id:true,legal_documents_published:true,independent_registration_enabled:true,legal_version:"2026-11-01-v1"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});

test("The dependency probe verifies the real public launch-control API, not whether registration is open",async()=>{
 let called=0;
 const requester:typeof fetch=async(input,init)=>{
  called++;
  assert.equal(String(input),url+"/rest/v1/bpei_launch_controls?select=id,legal_documents_published,independent_registration_enabled,legal_version&id=eq.true&limit=1");
  assert.equal(init?.method,"GET");
  assert.equal(new Headers(init?.headers).get("apikey"),key);
  assert.equal(new Headers(init?.headers).get("authorization"),null);
  assert.equal(init?.cache,"no-store");
  assert.equal(init?.redirect,"error");
  assert.ok(init?.signal,"Request must have an explicit timeout");
  return response([closed]);
 };
 assert.equal(await bpeiSupabaseDependencyAvailable({url,publishableKey:key},requester),true);
 assert.equal(called,1);
 assert.equal(await bpeiSupabaseDependencyAvailable({url,publishableKey:key},async()=>response([open])),true);
});

test("Invalid or privileged credentials never reach the network",async()=>{
 let called=0;
 const requester:typeof fetch=async()=>{called++;return response([closed])};
 for(const bad of ["", "sb_secret_"+ "s".repeat(30),"sk_test_"+ "x".repeat(30),"eyJhbGci.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature","sb_publishable_short"]){
  assert.equal(await bpeiSupabaseDependencyAvailable({url,publishableKey:bad},requester),false,bad.slice(0,14));
 }
 for(const badUrl of ["http://bpei-synthetic.supabase.co","https://untrusted.example",
  "https://bpei-synthetic.supabase.co.evil.test","https://user:pass@bpei-synthetic.supabase.co",
  "https://bpei-synthetic.supabase.co/rest/v1","https://bpei-synthetic.supabase.co/?token=x"]){
  assert.equal(await bpeiSupabaseDependencyAvailable({url:badUrl,publishableKey:key},requester),false,badUrl);
 }
 assert.equal(called,0,"No invalid endpoint or credential should cause any network call");
});

test("Dependency failures and malformed API responses are not reported as healthy",async()=>{
 for(const [data,status] of [
  [[],200],[{},200],[null,200],[[closed,closed],200],
  [[{id:false,legal_documents_published:false,independent_registration_enabled:false,legal_version:null}],200],
  [[{id:true,legal_documents_published:"false",independent_registration_enabled:false,legal_version:null}],200],
  [[closed],401],[[closed],403],[[closed],503]
 ] as const){
  assert.equal(await bpeiSupabaseDependencyAvailable({url,publishableKey:key},async()=>response(data,status)),false,
   "Unexpected healthy dependency: "+JSON.stringify({data,status}));
 }
 assert.equal(await bpeiSupabaseDependencyAvailable({url,publishableKey:key},async()=>{throw new Error("network disconnected")}),false);
 assert.equal(await bpeiSupabaseDependencyAvailable({url,publishableKey:key},async()=>new Response("bad-json")),false);
});

test("API route distinguishes server liveness and dependency availability without leaking data",()=>{
 const route=readFileSync(new URL("../src/routes/health.dependencies.tsx",import.meta.url),"utf8");
 const live=readFileSync(new URL("../src/routes/health.tsx",import.meta.url),"utf8");
 const smoke=readFileSync(new URL("../scripts/smoke-http.mjs",import.meta.url),"utf8");
 assert.match(route,/createFileRoute\("\/health\/dependencies"\)/);
 assert.match(route,/process\.env\.SUPABASE_URL/);
 assert.match(route,/process\.env\.SUPABASE_PUBLISHABLE_KEY/);
 assert.match(route,/status:reachable\?200:503/);
 assert.match(route,/scope:"dependency_only"/);
 assert.match(route,/no-store/);
 assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|email_confirmed_at/);
 assert.match(live,/createFileRoute\("\/health"\)/);
 assert.match(smoke,/\/health\/dependencies/);
 assert.match(smoke,/dependencyResponse\.status,503/);
});
