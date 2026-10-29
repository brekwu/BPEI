// Stripe Connect webhook. Test-only; signature before parsing, no JWT public bypass.
import {createClient} from "npm:@supabase/supabase-js@2";
import {verifyStripeSignature,parseStripeCheckoutSignal} from "./stripe-guards.ts";
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
 // Stripe retries unknown event types? Acknowledge ignored events, never mark paid.
 if(!signal)return json(200,"ignored");
 try{
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error}=await admin.rpc("mvp_test_checkout_webhook",{
   p_event_id:signal.eventId,p_attempt_id:signal.attemptId,p_session_id:signal.sessionId,
   p_account_id:signal.connectedAccountId,p_amount_cents:signal.amountCents,
   p_currency:signal.currency,p_intent_id:signal.intentId,p_kind:signal.kind
  });
  if(error){
   console.error("BPEI webhook reconciliation rejected",error.code??"database_failure");
   return json(500,"retry_later");
  }
  return json(200,"processed");
 }catch{return json(500,"retry_later");}
});
