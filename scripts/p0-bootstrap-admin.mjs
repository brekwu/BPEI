#!/usr/bin/env node
/**
 * BPEI P0 — first administrator bootstrap from an EXISTING verified Auth identity.
 *
 * This script deliberately NEVER creates users, NEVER forces email confirmation,
 * NEVER supplies a password, and NEVER bypasses the BPEI legal/Auth signup hook.
 * Run locally with a privileged service key only after an individual has
 * personally verified their actual email via the project Auth provider.
 *
 *   BPEI_SUPABASE_URL=https://qmbsfmcotnsxsvbigynz.supabase.co \
 *   BPEI_SUPABASE_SERVICE_KEY=<PRIVATE_SERVICE_ROLE_KEY> \
 *   BPEI_ADMIN_EMAIL=<ACTUAL_CONFIRMED_EMAIL> \
 *   node scripts/p0-bootstrap-admin.mjs --execute --user-id <EXISTING_AUTH_USER_UUID>
 *
 * Without --execute the script validates configuration and reports no mutation.
 */
import { createClient } from "@supabase/supabase-js";

const EXPECTED_REF = "qmbsfmcotnsxsvbigynz";
const execute = process.argv.includes("--execute");
const userIndex = process.argv.indexOf("--user-id");
const userId = userIndex < 0 ? "" : (process.argv[userIndex+1]??"");
const url = process.env.BPEI_SUPABASE_URL ?? "";
const key = process.env.BPEI_SUPABASE_SERVICE_KEY ?? "";
const email = (process.env.BPEI_ADMIN_EMAIL ?? "").trim().toLowerCase();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fail(message) {
 console.error("P0 bootstrap refused:",message);
 process.exitCode=1;
}
if(!execute){
 console.log("Dry run. No user or administrator record has been created.");
 console.log("Use --execute --user-id for an EXISTING Auth user with a verified email.");
}else if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)
 ||new URL(url).hostname!==EXPECTED_REF+".supabase.co"){
 fail("Wrong project URL; this action is pinned to BPEI.");
}else if(!key||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!uuid.test(userId)){
 fail("Service key, explicit verified email and existing --user-id UUID required.");
}else{
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const {data:u,error:lookup}=await db.auth.admin.getUserById(userId);
  const actor=u?.user;
  if(lookup||!actor||actor.id!==userId||actor.email?.toLowerCase()!==email
    ||!actor.email_confirmed_at||actor.is_anonymous===true||actor.deleted_at){
   throw Error("Existing, non-anonymous, non-deleted Auth user with verified matching email required.");
  }
  const {data:existing,error:listed}=await db.from("independent_admins")
   .select("user_id").limit(2);
  if(listed)throw Error("Could not inspect current BPEI admins: "+listed.message);
  if((existing??[]).length!==0)
   throw Error("Bootstrap disabled: one or more administrators already exist.");
  const {error:created}=await db.from("independent_admins").insert({user_id:userId});
  if(created)throw Error("Privilege grant failed: "+created.message);
  const {data:check,error:checked}=await db.from("independent_admins")
   .select("user_id").eq("user_id",userId).single();
  if(checked||check?.user_id!==userId)
   throw Error("Role insert not verified; review DB manually before any retry.");
  // Remove the one-time creation bypass marker after verification and grant.
  if(actor.app_metadata?.bpei_admin_bootstrap===true){
   const clean={...actor.app_metadata};
   delete clean.bpei_admin_bootstrap;
   const {error:cleanError}=await db.auth.admin.updateUserById(userId,{
    app_metadata:clean
   });
   if(cleanError)throw Error("Admin granted but temporary Auth bypass marker cleanup failed; manual review required.");
  }
  console.log("BPEI first administrator role granted to a genuinely verified Auth user.");
  console.log("The account is not an indication that SMTP, legal or Stripe gates have passed.");
 }catch(error){fail(error instanceof Error?error.message:"Unknown error");}
}
