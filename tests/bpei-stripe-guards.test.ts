import test from "node:test";
import assert from "node:assert/strict";
import {verifyStripeSignature,parseStripeCheckoutSignal} from "../src/lib/bpei-stripe-guards.ts";
const enc=new TextEncoder();
const whsec="whsec_mock_only_for_unit_test";
async function sign(body:string,t=1800000000){
 const key=await crypto.subtle.importKey("raw",enc.encode(whsec),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,enc.encode(t+"."+body)));
 return "t="+t+",v1="+Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
}
test("Stripe signed raw body: valid HMAC and timestamp",async()=>{
 const payload=JSON.stringify({id:"evt_123",data:{object:{status:"ok"}}});
 assert.equal(await verifyStripeSignature(payload,await sign(payload),whsec,1800000000),true);
 assert.equal(await verifyStripeSignature(payload+" ",await sign(payload),whsec,1800000000),false);
 assert.equal(await verifyStripeSignature(payload,await sign(payload),whsec,1800000301),false);
 assert.equal(await verifyStripeSignature(payload,await sign(payload),"wrong",1800000000),false);
 assert.equal(await verifyStripeSignature(payload,"t=x,v1=oops",whsec,1800000000),false);
});
const event={
 id:"evt_987",account:"acct_123456",livemode:false,type:"checkout.session.completed",
 data:{object:{object:"checkout.session",mode:"payment",id:"cs_test_123",
 currency:"eur",amount_total:10800,payment_status:"paid",payment_intent:"pi_123",
 metadata:{bpei_attempt_id:"11111111-1111-4111-8111-111111111111"}}}
};
test("Valid Connect checkout signal is normalized",()=>{
 const parsed=parseStripeCheckoutSignal(event);
 assert.equal(parsed?.amountCents,10800);
 assert.equal(parsed?.connectedAccountId,"acct_123456");
 assert.equal(parsed?.kind,"paid");
});
test("Reject live, mismatched, unpaid and malformed session signals",()=>{
 assert.equal(parseStripeCheckoutSignal({...event,livemode:true}),null);
 assert.equal(parseStripeCheckoutSignal({...event,account:""}),null);
 assert.equal(parseStripeCheckoutSignal({...event,data:{object:{...event.data.object,payment_status:"unpaid"}}}),null);
 assert.equal(parseStripeCheckoutSignal({...event,data:{object:{...event.data.object,amount_total:108.5}}}),null);
 assert.equal(parseStripeCheckoutSignal({...event,data:{object:{...event.data.object,id:"cs_live_123"}}}),null);
 assert.equal(parseStripeCheckoutSignal({...event,data:{object:{...event.data.object,metadata:{bpei_attempt_id:"not-a-uuid"}}}}),null);
});
test("Expired and failed sessions cannot be interpreted as paid",()=>{
 assert.equal(parseStripeCheckoutSignal({...event,type:"checkout.session.expired",data:{object:{...event.data.object,payment_status:"unpaid"}}})?.kind,"expired");
 assert.equal(parseStripeCheckoutSignal({...event,type:"checkout.session.async_payment_failed",data:{object:{...event.data.object,payment_status:"unpaid"}}})?.kind,"failed");
});
