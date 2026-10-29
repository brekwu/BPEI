// Stripe Connect webhook. Test-only; signature before parsing, no JWT public bypass.
import {createClient} from "npm:@supabase/supabase-js@2";
import {verifyStripeSignature,parseStripeCheckoutSignal} from "./stripe-guards.ts";
import {parseStripeAdjustmentSignal} from "./stripe-adjustments.ts";
const json=(status:number,msg:string)=>new Response(JSON.stringify({status:msg}),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
Deno.serve(async req=>{
 if(req.method!=="POST")return json(405,"method_not_allowed");
 if(Deno.env.get("BPEI_TEST_CHECKOUT_ENABLED")!=="true")return json(503,"checkout_disabled");
 const secret=Deno.env.get("BPEI_STRIPE_CONNECT_WEBHOOK_SECRET")??"";
 const url=Deno.env.get("SUPABASE_URL")??"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!secret.startsWith("whsec_")||!url.startsWith("https://")||!service)
  return json(503,"not_configured");
 const length=Number(req.headers.get("content-length")??"0");
 if(length>1000000)return json(413,"payload_too_large");
 let raw:string;
 try{raw=await req.text();}catch{return json(400,"invalid_body");}
 const signature=req.headers.get("Stripe-Signature")??"";
 if(!(await verifyStripeSignature(raw,signature,secret)))return json(400,"invalid_signature");
 let payload:unknown;
 try{payload=JSON.parse(raw);}catch{return json(400,"invalid_json");}
 const signal=parseStripeCheckoutSignal(payload);
 const adjustment=signal?null:parseStripeAdjustmentSignal(payload);
 // Unknown Stripe event types must never mark a payment paid.
 if(!signal&&!adjustment)return json(200,"ignored");
 try{
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  if(signal){
   const {error}=await admin.rpc("mvp_test_checkout_webhook",{
    p_event_id:signal.eventId,p_attempt_id:signal.attemptId,p_session_id:signal.sessionId,
    p_account_id:signal.connectedAccountId,p_amount_cents:signal.amountCents,
    p_currency:signal.currency,p_intent_id:signal.intentId,p_kind:signal.kind
   });
   if(error){
    console.error("BPEI checkout webhook rejected",error.code??"database_failure");
    return json(500,"retry_later");
   }
   return json(200,"processed");
  }
  if(!adjustment)return json(200,"ignored");
  // A refund/dispute is attached to the verified Stripe PI on a specific connected account.
  const {data:attempts,error:lookupError}=await admin.from("bpei_payment_attempts")
   .select("id").eq("connected_account_id",adjustment.accountId)
   .eq("stripe_payment_intent_id",adjustment.paymentIntentId).eq("state","paid").limit(2);
  if(lookupError||!attempts||attempts.length!==1){
   console.error("BPEI adjustment unmatched or ambiguous");
   return json(500,"retry_later");
  }
  const {error}=await admin.rpc("mvp_test_payment_adjustment_event",{
   p_event_id:adjustment.eventId,p_attempt_id:attempts[0].id,
   p_account_id:adjustment.accountId,p_payment_intent_id:adjustment.paymentIntentId,
   p_object_id:adjustment.objectId,p_kind:adjustment.kind,p_status:adjustment.status,
   p_amount_cents:adjustment.amountCents,p_provider_created:adjustment.providerCreated
  });
  if(error){
   console.error("BPEI adjustment reconciliation rejected",error.code??"database_failure");
   return json(500,"retry_later");
  }
  return json(200,"processed");
 }catch{return json(500,"retry_later");}
});
