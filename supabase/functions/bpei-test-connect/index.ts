// BPEI Stripe Connect Accounts v2: test-only self-onboarding with explicit admin approval.
// Never creates a live account and never assumes an existing Stripe account belongs to BPEI.
import {createClient} from "npm:@supabase/supabase-js@2";
const answer=(status:number,body:unknown,origin="")=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
 ...(origin?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{})}
});
const getEnv=()=>({
 secret:Deno.env.get("STRIPE_SECRET_KEY")??"",
 enabled:Deno.env.get("BPEI_TEST_CONNECT_ENABLED")==="true",
 origin:Deno.env.get("BPEI_TEST_CONNECT_ORIGIN")??"",
 url:Deno.env.get("SUPABASE_URL")??"",
 service:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""
});
const stripeVersion="2026-09-30.endive";
function trustedOrigin(value:string):string{
 try{
  const u=new URL(value);
  if(u.protocol==="https:"&&u.pathname==="/"&&!u.search&&!u.hash
    &&!u.username&&!u.password&&!u.port)return u.origin;
 }catch{/* misconfigured */}
 return "";
}
const isAccount=(id:unknown)=>typeof id==="string"&&/^acct_[A-Za-z0-9]+$/.test(id);
async function stripe(
 path:string,key:string,init?:{method:"POST";body:unknown;idempotency?:string}
):Promise<any>{
 const r=await fetch("https://api.stripe.com"+path,{
  method:init?.method??"GET",
  headers:{Authorization:"Bearer "+key,
   "Stripe-Version":stripeVersion,
   ...(init?{"Content-Type":"application/json"}:{}),
   ...(init?.idempotency?{"Idempotency-Key":init.idempotency}:{})},
  ...(init?{body:JSON.stringify(init.body)}:{})
 });
 const data=await r.json().catch(()=>null);
 if(!r.ok||!data)throw new Error("Stripe test account operation rejected");
 return data;
}
async function providerReady(accountId:string,key:string):Promise<boolean>{
 // A v2 account may be inspected through v1's compatibility API, but never changed through v1.
 const response=await fetch("https://api.stripe.com/v1/accounts/"+accountId,
  {headers:{Authorization:"Bearer "+key}});
 const account=await response.json().catch(()=>null);
 if(!response.ok||!account||account.id!==accountId||account.livemode!==false
   ||account.country!=="FR")throw new Error("Unexpected Stripe merchant");
 return account.charges_enabled===true&&account.payouts_enabled===true
   &&account.details_submitted===true;
}
Deno.serve(async req=>{
 const e=getEnv(),origin=trustedOrigin(e.origin);
 const incoming=req.headers.get("Origin");
 if(req.method==="OPTIONS"){
  if(!origin||incoming!==origin)return answer(403,{error:"origin_denied"});
  return new Response(null,{status:204,headers:{
   "Access-Control-Allow-Origin":origin,
   "Access-Control-Allow-Methods":"POST,OPTIONS",
   "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
   "Vary":"Origin"
  }});
 }
 if(req.method!=="POST")return answer(405,{error:"method_not_allowed"});
 if(incoming&&incoming!==origin)return answer(403,{error:"origin_denied"});
 if(!e.enabled||!origin||!e.secret.startsWith("sk_test_")
   ||!e.url.startsWith("https://")||!e.service)
  return answer(503,{error:"test_connect_not_configured"},origin);
 const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")??"";
 if(!bearer)return answer(401,{error:"login_required"},origin);
 let payload:any;
 try{payload=await req.json()}catch{return answer(400,{error:"invalid_json"},origin)}
 if(!payload||typeof payload!=="object"||!["status","start","approve"].includes(payload.action))
  return answer(400,{error:"invalid_action"},origin);
 try{
  const db=createClient(e.url,e.service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authErr}=await db.auth.getUser(bearer);
  const user=auth.user;
  if(authErr||!user||user.is_anonymous||!user.email_confirmed_at)
   return answer(401,{error:"confirmed_identity_required"},origin);
  const {data:admin,error:adminErr}=await db.from("independent_admins")
   .select("user_id").eq("user_id",user.id).maybeSingle();
  if(adminErr)return answer(503,{error:"authorization_unavailable"},origin);
  const isAdmin=admin?.user_id===user.id;
  const issuerId=payload.action==="approve"?payload.issuer_id:user.id;
  if(typeof issuerId!=="string"||!/^[0-9a-f-]{36}$/i.test(issuerId))
   return answer(400,{error:"invalid_issuer"},origin);
  if(payload.action==="approve"&&!isAdmin)
   return answer(403,{error:"administrator_required"},origin);
  const [{data:profile,error:profileErr},{data:app,error:appErr},
   {data:verification,error:verificationErr},{data:legal,error:legalErr}]=await Promise.all([
   db.from("independent_profiles").select("user_id,siret,display_name,verified_at")
    .eq("user_id",issuerId).maybeSingle(),
   db.from("independent_applications").select("status").eq("user_id",issuerId).maybeSingle(),
   db.from("independent_verification_checks")
    .select("identity_confirmed,enterprise_active,establishment_active,insurance_confirmed,insurance_expires_on")
    .eq("user_id",issuerId).maybeSingle(),
   db.from("bpei_launch_controls")
    .select("legal_documents_published,legal_version").eq("id",true).maybeSingle()
  ]);
  if(profileErr||appErr||verificationErr||legalErr)return answer(503,{error:"eligibility_unavailable"},origin);
  if(!profile||!app||!verification||!legal
    ||legal.legal_documents_published!==true||!legal.legal_version
    ||!profile.verified_at||app.status!=="approved"
    ||verification.identity_confirmed!==true
    ||verification.enterprise_active!==true
    ||verification.establishment_active!==true
    ||verification.insurance_confirmed!==true
    ||!verification.insurance_expires_on
    ||verification.insurance_expires_on<new Date().toISOString().slice(0,10)
    ||typeof profile.siret!=="string"||!/^[0-9]{14}$/.test(profile.siret))
   return answer(403,{error:"professional_and_legal_approval_required"},origin);
  const {data:accepted,error:acceptErr}=await db.from("bpei_legal_acceptances")
   .select("legal_version").eq("user_id",issuerId)
   .eq("legal_version",legal.legal_version).maybeSingle();
  if(acceptErr||!accepted)return answer(403,{error:"current_terms_not_accepted"},origin);
  let {data:mapping,error:mappingErr}=await db.from("bpei_stripe_connected_accounts")
   .select("stripe_account_id,test_enabled,test_verified_at")
   .eq("issuer_id",issuerId).maybeSingle();
  if(mappingErr)return answer(503,{error:"merchant_status_unavailable"},origin);
  if(payload.action==="start"&&!mapping){
   if(!user.email)return answer(403,{error:"verified_email_required"},origin);
   // Self-service account creation is based on the verified user's email only;
   // Stripe collects real company details directly from the account holder.
   const account=await stripe("/v2/core/accounts",e.secret,{
    method:"POST",idempotency:"bpei-test-connect-v2-"+issuerId,
    body:{contact_email:user.email,
     display_name:String(profile.display_name).slice(0,120),
     dashboard:"full",identity:{country:"FR"},
     defaults:{currency:"eur",responsibilities:{
      fees_collector:"stripe",losses_collector:"stripe"}},
     configuration:{merchant:{capabilities:{card_payments:{requested:true}}}}
    }
   });
   if(!isAccount(account.id)||account.livemode!==false)
    throw new Error("Unexpected account creation mode");
   const inserted=await db.from("bpei_stripe_connected_accounts")
    .insert({issuer_id:issuerId,stripe_account_id:account.id,test_enabled:false})
    .select("stripe_account_id,test_enabled,test_verified_at").single();
   if(inserted.error||!inserted.data)throw new Error("Account ledger registration failed");
   mapping=inserted.data;
  }
  if(!mapping||!isAccount(mapping.stripe_account_id))
   return answer(200,{status:"not_connected",approved:false,ready:false,mode:"test"},origin);
  const accountId=mapping.stripe_account_id;
  const ready=await providerReady(accountId,e.secret);
  if(ready&&!mapping.test_verified_at){
   const saved=await db.from("bpei_stripe_connected_accounts")
    .update({test_verified_at:new Date().toISOString()})
    .eq("issuer_id",issuerId).eq("stripe_account_id",accountId);
   if(saved.error)throw new Error("Provider status update failed");
  }
  if(payload.action==="approve"){
   if(!ready)return answer(409,{error:"merchant_not_ready"},origin);
   const updated=await db.from("bpei_stripe_connected_accounts")
    .update({test_enabled:true,test_verified_at:new Date().toISOString()})
    .eq("issuer_id",issuerId).eq("stripe_account_id",accountId);
   if(updated.error)throw new Error("Merchant approval save failed");
   return answer(200,{status:"approved_test",approved:true,ready:true,mode:"test"},origin);
  }
  if(payload.action==="start"){
   if(ready)return answer(200,{
    status:mapping.test_enabled?"approved_test":"awaiting_bpei_approval",
    approved:!!mapping.test_enabled,ready:true,mode:"test"
   },origin);
   // Stripe account links are short-lived. The return URL is informational only.
   const link=await stripe("/v2/core/account_links",e.secret,{
    method:"POST",
    body:{account:accountId,
     use_case:{type:"account_onboarding",
      account_onboarding:{
       return_url:origin+"/connexion-paiement/retour",
       refresh_url:origin+"/connexion-paiement/retour?renouveler=1",
       configurations:["merchant"]
      }
     }
    }
   });
   const u=new URL(link.url);
   if(u.protocol!=="https:"||u.hostname!=="accounts.stripe.com"
     ||link.livemode!==false)throw new Error("Untrusted Stripe onboarding link");
   return answer(200,{status:"onboarding",url:link.url,approved:false,ready:false,mode:"test"},origin);
  }
  return answer(200,{
   status:mapping.test_enabled&&ready?"approved_test":
    ready?"awaiting_bpei_approval":"onboarding_required",
   approved:!!mapping.test_enabled&&ready,ready,mode:"test"
  },origin);
 }catch(err){
  console.error("BPEI Connect TEST flow unavailable",err instanceof Error?err.message:"unexpected");
  return answer(503,{error:"connect_temporarily_unavailable"},origin);
 }
});
