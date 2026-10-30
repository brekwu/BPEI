#!/usr/bin/env node
// BPEI P0 existing-account AUTH + RLS smoke. Does not create users, make charges,
// send emails, promote admins or publish any documents. Requires real test accounts.
import {createClient} from "@supabase/supabase-js";
import assert from "node:assert/strict";

const env=process.env;
const required=["BPEI_P0_URL","BPEI_P0_PUBLISHABLE_KEY",
 "BPEI_P0_ADMIN_EMAIL","BPEI_P0_ADMIN_PASSWORD",
 "BPEI_P0_PARTNER_EMAIL","BPEI_P0_PARTNER_PASSWORD"];
const missing=required.filter(k=>!env[k]);
if(missing.length){
 console.error("P0 LIVE CHECK BLOCKED: missing test configuration: "+missing.join(", "));
 process.exit(2);
}
const url=env.BPEI_P0_URL;
assert.ok(/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url),
 "Only explicit official Supabase project endpoints are allowed.");
const key=env.BPEI_P0_PUBLISHABLE_KEY;
if(!/^sb_publishable_|^eyJ/.test(key))throw Error("A public publishable/legacy anon key is required, never a service_role secret");
const create=()=>createClient(url,key,{auth:{
 autoRefreshToken:false,persistSession:false,detectSessionInUrl:false
}});
const admin=create(),partner=create(),anonymous=create();
try{
 const anon=await anonymous.rpc("p0_readiness");
 assert.ok(anon.error,"Unregistered visitor must not see operator launch evidence");
 console.info("OK anonymous launch diagnostic denied");
 const a=await admin.auth.signInWithPassword({
  email:env.BPEI_P0_ADMIN_EMAIL,password:env.BPEI_P0_ADMIN_PASSWORD
 });
 assert.ifError(a.error);
 assert.ok(a.data.user?.email_confirmed_at,"The administrator must confirm the actual email");
 const role=await admin.from("independent_admins").select("user_id")
  .eq("user_id",a.data.user.id).maybeSingle();
 assert.ifError(role.error);
 assert.equal(role.data?.user_id,a.data.user.id,"An explicit administrator assignment is required");
 const ready=await admin.rpc("p0_readiness");
 assert.ifError(ready.error);
 assert.equal(ready.data?.mode,"preproduction");
 assert.equal(typeof ready.data?.all_ready,"boolean");
 console.info("OK confirmed admin sees release readiness; ready="+ready.data.all_ready);
 const p=await partner.auth.signInWithPassword({
  email:env.BPEI_P0_PARTNER_EMAIL,password:env.BPEI_P0_PARTNER_PASSWORD
 });
 assert.ifError(p.error);
 assert.ok(p.data.user,"Real partner test account is required");
 assert.notEqual(p.data.user.id,a.data.user.id,"Independent and administrator must be distinct users");
 const denied=await partner.rpc("p0_readiness");
 assert.ok(denied.error,"Ordinary partners must not see private P0 evidence");
 const fake=await partner.rpc("record_p0_attestation",{
  p_check_key:"smtp_auth_delivery",
  p_evidence_reference:"This test must never create a real operator verification record",
  p_passed:true
 });
 assert.ok(fake.error,"Ordinary users must not create P0 attestation");
 console.info("OK non-admin cannot read or forge launch proofs");
 console.info("No public opening, payment, email, invoice or release operation was executed.");
}finally{
 await Promise.allSettled([admin.auth.signOut(),partner.auth.signOut()]);
}
