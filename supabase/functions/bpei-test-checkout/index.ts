// BPEI Stripe Connect TEST-only Checkout. Requires explicit private opt-in, no live charges.
import {createClient} from "npm:@supabase/supabase-js@2";
const json=(data:unknown,status=200,origin="")=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
 ...(origin?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{})}
});
const config=()=>({
 supabaseUrl:Deno.env.get("SUPABASE_URL")??"",
 serviceKey:Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"",
 stripeKey:Deno.env.get("STRIPE_SECRET_KEY")??"",
 returnOrigin:Deno.env.get("BPEI_CHECKOUT_RETURN_ORIGIN")??"",
 enabled:Deno.env.get("BPEI_TEST_CHECKOUT_ENABLED")==="true"
});
Deno.serve(async req=>{
 const c=config();
 let allowedOrigin="";
 try{
  const parsed=new URL(c.returnOrigin);
  if(parsed.protocol==="https:"&&!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash
   &&!parsed.pathname.replaceAll("/",""))allowedOrigin=parsed.origin;
 }catch{/* invalid return address disables checkout */}
 if(req.method==="OPTIONS"){
  if(allowedOrigin&&req.headers.get("Origin")===allowedOrigin)
   return new Response(null,{status:204,headers:{
    "Access-Control-Allow-Origin":allowedOrigin,"Access-Control-Allow-Methods":"POST,OPTIONS",
    "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Vary":"Origin"}});
  return json({error:"Unavailable"},403);
 }
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const origin=req.headers.get("Origin");
 if(origin&&origin!==allowedOrigin)return json({error:"Origin denied"},403);
 if(!c.enabled||!allowedOrigin||!c.stripeKey.startsWith("sk_test_")
  ||!c.supabaseUrl.startsWith("https://")||!c.serviceKey)
  return json({error:"Test payment integration not configured"},503,allowedOrigin);
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return json({error:"Authentication required"},401,allowedOrigin);
 let attemptId="";
 let admin:any;
 try{
  const payload=await req.json() as Record<string,unknown>;
  const invoice=payload.invoice_id;
  if(typeof invoice!=="string"||!/^[0-9a-f-]{36}$/i.test(invoice))
   return json({error:"Invalid invoice"},400,allowedOrigin);
  admin=createClient(c.supabaseUrl,c.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authErr}=await admin.auth.getUser(token);
  if(authErr||!auth.user||auth.user.is_anonymous||!auth.user.email_confirmed_at)
   return json({error:"Confirmed account required"},401,allowedOrigin);
  const {data:role,error:roleErr}=await admin.from("independent_admins")
   .select("user_id").eq("user_id",auth.user.id).maybeSingle();
  if(roleErr||!role)return json({error:"Administrator required"},403,allowedOrigin);
  const {data:attempt,error:prepareErr}=await admin.rpc("mvp_test_checkout_prepare",{p_invoice_id:invoice});
  if(prepareErr||!attempt)return json({error:"Payment unavailable for this invoice"},409,allowedOrigin);
  attemptId=attempt.attempt_id;
  const accountId=attempt.account_id;
  const amount=Number(attempt.amount_cents);
  const fee=Number(attempt.application_fee_cents);
  if(!/^acct_[a-zA-Z0-9]+$/.test(accountId)||!Number.isSafeInteger(amount)
   ||amount<100||amount>99999999||!Number.isSafeInteger(fee)
   ||fee<0||fee>Math.floor((amount*2500+5000)/10000))
   throw new Error("Invalid merchant, amount or documented commission");
  const accountResponse=await fetch("https://api.stripe.com/v1/accounts/"+accountId,{
   headers:{Authorization:"Bearer "+c.stripeKey}
  });
  const account=await accountResponse.json();
  if(!accountResponse.ok||account.livemode===true||account.country!=="FR"
   ||account.charges_enabled!==true||account.payouts_enabled!==true)
   throw new Error("Connected test merchant not validated");
  const form=new URLSearchParams();
  form.set("mode","payment");
  if(fee>0)form.set("payment_intent_data[application_fee_amount]",String(fee));
  form.set("payment_method_types[0]","card");
  form.set("success_url",allowedOrigin+"/paiement/retour?session_id={CHECKOUT_SESSION_ID}");
  form.set("cancel_url",allowedOrigin+"/paiement/retour?annule=1");
  form.set("line_items[0][price_data][currency]","eur");
  form.set("line_items[0][price_data][unit_amount]",String(amount));
  form.set("line_items[0][price_data][product_data][name]",String(attempt.description).slice(0,200));
  form.set("line_items[0][quantity]","1");
  form.set("client_reference_id",invoice);
  form.set("customer_email",String(attempt.email));
  form.set("metadata[bpei_attempt_id]",attemptId);
  const sessionResponse=await fetch("https://api.stripe.com/v1/checkout/sessions",{
   method:"POST",headers:{
    Authorization:"Bearer "+c.stripeKey,
    "Stripe-Account":accountId,
    "Idempotency-Key":"bpei-test-"+attemptId,
    "Content-Type":"application/x-www-form-urlencoded"
   },body:form.toString()
  });
  const session=await sessionResponse.json();
  if(!sessionResponse.ok||typeof session.id!=="string"
   ||!session.id.startsWith("cs_test_")||typeof session.url!=="string")
   throw new Error("Stripe test Checkout creation refused");
  const {error:attached}=await admin.rpc("mvp_test_checkout_attach",{
   p_attempt_id:attemptId,p_session_id:session.id
  });
  if(attached){
   // Best effort: don't leave an untracked Stripe Checkout session active.
   await fetch("https://api.stripe.com/v1/checkout/sessions/"+session.id+"/expire",{
    method:"POST",headers:{"Authorization":"Bearer "+c.stripeKey,"Stripe-Account":accountId}
   }).catch(()=>{});
   throw new Error("Failed to bind checkout session");
  }
  const url=new URL(session.url);
  if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com")
   throw new Error("Checkout host not trusted");
  return json({url:session.url,mode:"test"},200,allowedOrigin);
 }catch(err){
  console.error("BPEI test checkout rejected:",err instanceof Error?err.message:"unknown");
  if(attemptId&&admin)await admin.rpc("mvp_test_checkout_abort",{p_attempt_id:attemptId}).catch(()=>{});
  return json({error:"Checkout temporarily unavailable"},503,allowedOrigin);
 }
});
