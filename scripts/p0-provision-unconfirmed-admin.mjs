#!/usr/bin/env node
/**
 * Stage 1 of BPEI first admin: PROVISION UNCONFIRMED ACCOUNT ONLY.
 * No fake email verification, no admin grant, no emails, no public signup.
 * This deliberately uses the existing explicitly restricted bootstrap marker
 * so a service-role provisioning operation can create one Auth user while
 * ordinary registrations remain disabled.
 *
 * Run from a trusted machine after identifying the real intended operator.
 * Environment: BPEI_SUPABASE_URL, BPEI_SUPABASE_SERVICE_KEY,
 * BPEI_ADMIN_EMAIL, BPEI_ADMIN_PASSWORD (strong and private).
 * Run --execute ONLY with authorized real operator credentials.
 *
 * After operator verifies the address through a REAL Auth confirmation,
 * execute p0-bootstrap-admin.mjs with --user-id.
 */
import {createClient} from "@supabase/supabase-js";
const EXPECTED_REF="qmbsfmcotnsxsvbigynz";
const execute=process.argv.includes("--execute");
const url=process.env.BPEI_SUPABASE_URL??"";
const secret=process.env.BPEI_SUPABASE_SERVICE_KEY??"";
const email=(process.env.BPEI_ADMIN_EMAIL??"").trim().toLowerCase();
const password=process.env.BPEI_ADMIN_PASSWORD??"";
const fail=(m)=>{console.error("P0 account provisioning refused:",m);process.exitCode=1;};
if(!execute){
 console.log("Dry run: no account, e-mail verification or role was created.");
}else if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)
 ||new URL(url).hostname!==EXPECTED_REF+".supabase.co"){
 fail("Incorrect Supabase project.");
}else if(!secret||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
 ||password.length<16||!/[a-z]/.test(password)||!/[A-Z]/.test(password)
 ||!/[0-9]/.test(password)||!/[^a-zA-Z0-9]/.test(password)){
 fail("Require explicit real operator email, service key and strong private password.");
}else{
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const {data:admins,error:readError}=await db.from("independent_admins")
   .select("user_id").limit(2);
  if(readError||admins?.length)throw Error("First-admin provisioning is disabled or cannot check existing admins.");
  // Admin-generated user is deliberately NOT confirmed. It can be promoted
  // ONLY after Supabase verifies email_confirmed_at from a genuine flow.
  const {data,error:created}=await db.auth.admin.createUser({
   email,password,email_confirm:false,
   app_metadata:{bpei_admin_bootstrap:true}
  });
  if(created||!data?.user?.id)throw Error("Auth refused unconfirmed account creation.");
  if(data.user.email_confirmed_at)
   throw Error("Unsafe Auth configuration: account was unexpectedly confirmed.");
  const {data:role,error:roleError}=await db.from("independent_admins")
   .select("user_id").eq("user_id",data.user.id).maybeSingle();
  if(roleError||role)throw Error("SECURITY ERROR: unverified account received an admin role.");
  console.log("Created one UNCONFIRMED Auth identity; no administrator privilege granted.");
  console.log("Auth user ID (not a secret):",data.user.id);
  console.log("Supabase Auth admin.createUser does NOT send a confirmation email.");
  console.log("After configuring real SMTP, the operator must sign in with their password");
  console.log("at /espace-independant and select the existing-account verification link.");
  console.log("The real received link must be opened BEFORE administrator promotion.");
  console.log("Do not set email_confirm=true or edit email_confirmed_at manually.");
 }catch(e){fail(e instanceof Error?e.message:"Unspecified account provisioning failure");}
}
