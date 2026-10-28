import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";

/**
 * P0 acceptance smoke with real Supabase accounts and actual RLS.
 *
 * READ-ONLY. Does not register accounts, approve applications, send mail,
 * publish legal documents, modify permissions, or open any intake.
 *
 * Exit 2: not configured; Exit 1: actual test failed; Exit 0: passed.
 */
const required=[
  "P0_SUPABASE_URL","P0_SUPABASE_PUBLISHABLE_KEY",
  "P0_ADMIN_EMAIL","P0_ADMIN_PASSWORD",
  "P0_TECH_A_EMAIL","P0_TECH_A_PASSWORD",
  "P0_TECH_B_EMAIL","P0_TECH_B_PASSWORD",
  "P0_APPLICATION_A_ID","P0_APPLICATION_B_ID",
  "P0_LEGAL_VERSION"
];
const missing=required.filter(k=>!process.env[k]);
if(missing.length){
 process.stderr.write("P0 LIVE AUTH NOT RUN: missing "+missing.join(", ")+"\n");
 process.exitCode=2;
}else{
 const env=process.env;
 const expectedProject="https://qmbsfmcotnsxsvbigynz.supabase.co";
 const validUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
 const clients=new Map(),users=new Map();
 try{
  assert.equal(new URL(env.P0_SUPABASE_URL).origin,expectedProject,
    "P0 acceptance must target the dedicated BPEI project");
  assert.ok(validUuid(env.P0_APPLICATION_A_ID),"Application A must be an existing UUID");
  assert.ok(validUuid(env.P0_APPLICATION_B_ID),"Application B must be an existing UUID");
  assert.notEqual(env.P0_APPLICATION_A_ID,env.P0_APPLICATION_B_ID);
  for(const [role,emailKey,passwordKey] of [
   ["admin","P0_ADMIN_EMAIL","P0_ADMIN_PASSWORD"],
   ["techA","P0_TECH_A_EMAIL","P0_TECH_A_PASSWORD"],
   ["techB","P0_TECH_B_EMAIL","P0_TECH_B_PASSWORD"]
  ]){
   const client=createClient(env.P0_SUPABASE_URL,env.P0_SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
   });
   const {data,error}=await client.auth.signInWithPassword({
    email:env[emailKey],password:env[passwordKey]
   });
   if(error||!data?.session||!data.user)throw Error(role+": real login unsuccessful");
   if(!data.user.email_confirmed_at)throw Error(role+": email not confirmed");
   clients.set(role,client);
   users.set(role,data.user.id);
  }
  assert.equal(new Set(users.values()).size,3,"Acceptance identities must be distinct");
  const select=async(client,table,columns,filter,value)=>{
   const {data,error}=await client.from(table).select(columns).eq(filter,value).limit(2);
   if(error)throw Error("Database query rejected for "+table+" ("+error.code+")");
   return data??[];
  };
  const admin=clients.get("admin");
  const adminRoster=await select(admin,"independent_admins","user_id","user_id",users.get("admin"));
  assert.equal(adminRoster.length,1,"Administrator has no verified admin membership");
  for(const [role,id,applicationId] of [
    ["techA",users.get("techA"),env.P0_APPLICATION_A_ID],
    ["techB",users.get("techB"),env.P0_APPLICATION_B_ID]
  ]){
   const client=clients.get(role);
   const ownProfile=await select(client,"independent_profiles","user_id","user_id",id);
   assert.equal(ownProfile.length,1,role+": own profile missing");
   const ownApplication=await select(client,"independent_applications","id,user_id","id",applicationId);
   assert.equal(ownApplication.length,1,role+": own application missing");
   assert.equal(ownApplication[0].user_id,id,role+": fixture owner mismatch");
   const otherRole=role==="techA"?"techB":"techA";
   const foreign=users.get(otherRole);
   assert.equal((await select(client,"independent_profiles","user_id","user_id",foreign)).length,0,
    role+": foreign profile leaked");
   assert.equal((await select(client,"independent_applications","id","id",
     env[otherRole==="techA"?"P0_APPLICATION_A_ID":"P0_APPLICATION_B_ID"])).length,0,
    role+": foreign application leaked");
   assert.equal((await select(client,"independent_admins","user_id","user_id",users.get("admin"))).length,0,
    role+": admin roster leaked");
  }
  for(const app of [env.P0_APPLICATION_A_ID,env.P0_APPLICATION_B_ID]){
   assert.equal((await select(admin,"independent_applications","id","id",app)).length,1,
    "Admin cannot review the two existing applications");
  }
  const {data:gate,error:gateError}=await admin.from("bpei_launch_controls")
    .select("legal_documents_published,legal_version,independent_registration_enabled").eq("id",true).maybeSingle();
  if(gateError)throw Error("Legal release status inaccessible");
  assert.equal(gate?.legal_documents_published,true,"Real test requires legally published documents");
  assert.equal(gate?.legal_version,env.P0_LEGAL_VERSION,"Release version mismatch");
  assert.equal(gate?.independent_registration_enabled,false,
    "P0 live acceptance must NOT run with new public registrations enabled");
  const {data:intakeFlags,error:intakeError}=await admin.from("bpei_intake_flags")
    .select("kind,enabled");
  if(intakeError)throw Error("Cannot verify real public inquiry intake flags");
  assert.equal((intakeFlags??[]).some(x=>x.enabled===true),false,
    "P0 live acceptance must NOT run with public intake enabled");
  const {data:docs,error:docsError}=await admin.from("bpei_legal_documents")
    .select("kind,approved_at").eq("version",env.P0_LEGAL_VERSION);
  if(docsError)throw Error("Published legal documents unreadable");
  for(const kind of ["mentions-legales","confidentialite","cgu"]){
   assert.ok(docs?.some(x=>x.kind===kind&&x.approved_at),kind+" legal document not approved");
  }
  process.stdout.write(JSON.stringify({result:"PASS",mode:"real-auth-rls-readonly",
    accounts:3,applications:2,legal_release:env.P0_LEGAL_VERSION})+"\n");
 }catch(error){
  process.exitCode=1;
  process.stderr.write("P0 LIVE AUTH FAILED: "+(error instanceof Error?error.message:"unknown error")+"\n");
 }finally{
  for(const c of clients.values())await c.auth.signOut().catch(()=>{});
 }
}
