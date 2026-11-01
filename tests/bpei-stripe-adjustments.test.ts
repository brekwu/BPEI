import test from "node:test";
import assert from "node:assert/strict";
import {parseStripeAdjustmentSignal} from "../src/lib/bpei-stripe-adjustments.ts";
const fixture={
 id:"evt_678",livemode:false,account:"acct_123456",created:1793300000,
 type:"refund.updated",data:{object:{id:"re_789",object:"refund",payment_intent:"pi_123",amount:9000,status:"succeeded"}}
};
test("Stripe TEST refund normalized only for signed-wrapper approved payload",()=>{
 assert.deepEqual(parseStripeAdjustmentSignal(fixture),{
  eventId:"evt_678",kind:"refund",objectId:"re_789",accountId:"acct_123456",
  paymentIntentId:"pi_123",amountCents:9000,status:"succeeded",providerCreated:1793300000
 });
});
test("Refund, dispute and failed refund states mapped without assuming payment",()=>{
 assert.equal(parseStripeAdjustmentSignal({...fixture,data:{object:{...fixture.data.object,status:"requires_action"}}})?.status,"pending");
 assert.equal(parseStripeAdjustmentSignal({...fixture,type:"refund.failed",data:{object:{...fixture.data.object,status:"failed"}}})?.status,"failed");
 assert.equal(parseStripeAdjustmentSignal({...fixture,type:"charge.dispute.created",data:{object:{
  id:"dp_abc",object:"dispute",payment_intent:"pi_123",amount:5000,status:"needs_response"}}})?.status,"open");
 assert.equal(parseStripeAdjustmentSignal({...fixture,type:"charge.dispute.closed",data:{object:{
  id:"dp_abc",object:"dispute",payment_intent:"pi_123",amount:5000,status:"lost"}}})?.status,"lost");
});
test("Invalid account, live events, absent intent and unsupported events discarded",()=>{
 assert.equal(parseStripeAdjustmentSignal({...fixture,livemode:true}),null);
 assert.equal(parseStripeAdjustmentSignal({...fixture,account:"invalid"}),null);
 assert.equal(parseStripeAdjustmentSignal({...fixture,type:"charge.succeeded"}),null);
 assert.equal(parseStripeAdjustmentSignal({...fixture,data:{object:{...fixture.data.object,payment_intent:null}}}),null);
 assert.equal(parseStripeAdjustmentSignal({...fixture,data:{object:{...fixture.data.object,amount:123.75}}}),null);
 assert.equal(parseStripeAdjustmentSignal({...fixture,data:{object:{...fixture.data.object,status:"unknown"}}}),null);
});
