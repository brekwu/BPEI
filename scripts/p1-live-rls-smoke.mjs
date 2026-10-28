import assert from "node:assert/strict";
import {createClient} from "@supabase/supabase-js";

/**
 * BPEI live RLS acceptance. READ-ONLY.
 * Run only with four authorized, verified preproduction accounts and two
 * pre-existing incidents + missions, one for each technician.
 * No registration, privilege promotion, admin modifications or public launch.
 */
const required=[
 "P1_SUPABASE_URL","P1_SUPABASE_PUBLISHABLE_KEY",
 "P1_ADMIN_A_EMAIL","P1_ADMIN_A_PASSWORD",
 "P1_ADMIN_B_EMAIL","P1_ADMIN_B_PASSWORD",
 "P1_TECH_A_EMAIL","P1_TECH_A_PASSWORD",
 "P1_TECH_B_EMAIL","P1_TECH_B_PASSWORD",
 "P1_INCIDENT_A_ID","P1_INCIDENT_B_ID",
 "P1_MISSION_A_ID","P1_MISSION_B_ID"
];
const missing=required.filter(key=>!process.env[key]);
if(missing.length){
 process.stderr.write("LIVE RLS NOT RUN: missing required variable names: "+missing.join(", ")+"\n");
 process.exitCode=2;
}else{
 const config=process.env;
 const userRoles=[
  ["adminA","P1_ADMIN_A_EMAIL","P1_ADMIN_A_PASSWORD"],
  ["adminB","P1_ADMIN_B_EMAIL","P1_ADMIN_B_PASSWORD"],
  ["techA","P1_TECH_A_EMAIL","P1_TECH_A_PASSWORD"],
  ["techB","P1_TECH_B_EMAIL","P1_TECH_B_PASSWORD"]
 ];
 const clients=new Map();
 const users=new Map();
 const checkUuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
 for(const id of ["P1_INCIDENT_A_ID","P1_INCIDENT_B_ID","P1_MISSION_A_ID","P1_MISSION_B_ID"]){
  assert.ok(checkUuid(config[id]),id+" must be an existing UUID fixture");
 }
 async function rows(client,table,field,value){
  const {data,error}=await client.from(table).select("id").eq(field,value).limit(2);
  if(error)throw new Error("RLS query failed for "+table+" ("+error.code+")");
  return data??[];
 }
 async function allowRow(client,table,id,label){
  assert.equal((await rows(client,table,"id",id)).length,1,label+" must see this record");
 }
 async function denyRow(client,table,id,label){
  assert.equal((await rows(client,table,"id",id)).length,0,label+" must not see this record");
 }
 try{
  for(const [role,emailKey,passKey] of userRoles){
   const client=createClient(config.P1_SUPABASE_URL,config.P1_SUPABASE_PUBLISHABLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
   });
   const {data,error}=await client.auth.signInWithPassword({
    email:config[emailKey],password:config[passKey]
   });
   if(error||!data.user||!data.session)throw new Error(role+": login failed or email not confirmed");
   if(!data.user.email_confirmed_at)throw new Error(role+": email confirmation missing");
   clients.set(role,client);users.set(role,data.user.id);
  }
  assert.equal(new Set(users.values()).size,4,"All role accounts must be distinct");
  for(const role of ["adminA","adminB"]){
   const client=clients.get(role);
   const {data,error}=await client.from("independent_admins").select("user_id")
    .in("user_id",[users.get("adminA"),users.get("adminB")]);
   if(error)throw new Error(role+": cannot read admin roster");
   assert.equal(data?.length,2,role+" must see both authorized administrators");
   for(const id of [config.P1_INCIDENT_A_ID,config.P1_INCIDENT_B_ID]){
    await allowRow(client,"bpei_mission_incidents",id,role);
   }
   const {data:stats,error:statsError}=await client.rpc("bpei_admin_incident_statistics",{p_days:30});
   assert.equal(statsError,null,role+": admin-only stats should be allowed");
   assert.equal(typeof stats?.total,"number",role+": missing statistics");
  }
  for(const [role,own,other,ownMission,otherMission] of [
   ["techA",config.P1_INCIDENT_A_ID,config.P1_INCIDENT_B_ID,config.P1_MISSION_A_ID,config.P1_MISSION_B_ID],
   ["techB",config.P1_INCIDENT_B_ID,config.P1_INCIDENT_A_ID,config.P1_MISSION_B_ID,config.P1_MISSION_A_ID]
  ]){
   const client=clients.get(role);
   await allowRow(client,"bpei_mission_incidents",own,role);
   await denyRow(client,"bpei_mission_incidents",other,role);
   await allowRow(client,"independent_requests",ownMission,role);
   await denyRow(client,"independent_requests",otherMission,role);
   const {data:roster,error:rosterError}=await client.from("independent_admins").select("user_id").limit(3);
   if(rosterError)throw new Error(role+": cannot query filtered admin roster");
   assert.equal(roster?.length,0,role+" must not list administrators");
   const {data:privateNotices,error:noticeError}=await client.from("bpei_notifications")
    .select("id").eq("recipient_id",users.get(role==="techA"?"techB":"techA"));
   if(noticeError)throw new Error(role+": notification RLS request failed");
   assert.equal(privateNotices.length,0,role+" must not see another inbox");
   const {error:statsError}=await client.rpc("bpei_admin_incident_statistics",{p_days:30});
   assert.ok(statsError,role+" must be denied admin statistics");
   const {error:missionError}=await client.rpc("bpei_admin_search_missions",{
    p_query:"",p_status:"all",p_attention:"all",p_limit:25,p_offset:0
   });
   assert.ok(missionError,role+" must be denied admin mission search");
  }
  process.stdout.write(JSON.stringify({
   result:"PASS",mode:"live-auth-read-only",roles_verified:4,fixture_incidents:2,
   fixture_missions:2,public_registration_changed:false
  })+"\n");
 }catch(error){
  process.exitCode=1;
  process.stderr.write("LIVE RLS FAILED: "+(error instanceof Error?error.message:"unknown error")+"\n");
 }finally{
  for(const client of clients.values())await client.auth.signOut().catch(()=>{});
 }
}
