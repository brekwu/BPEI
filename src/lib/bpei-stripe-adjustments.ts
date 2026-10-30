/** Normalize Stripe Connect refund/dispute events after validating the raw HMAC signature.
 * Strictly TEST mode. This parser does not move money or mark invoices paid.
 */
export type StripeAdjustmentSignal={
 eventId:string;kind:"refund"|"dispute";objectId:string;
 accountId:string;paymentIntentId:string;amountCents:number;
 status:"pending"|"succeeded"|"failed"|"canceled"|"open"|"won"|"lost";
 providerCreated:number;
};
const id=(x:unknown,prefix:string)=>typeof x==="string" && new RegExp("^"+prefix+"_[A-Za-z0-9_]+$").test(x);
export function parseStripeAdjustmentSignal(value:unknown):StripeAdjustmentSignal|null{
 if(!value||typeof value!=="object")return null;
 const e=value as Record<string,unknown>;
 if(e.livemode!==false||!id(e.id,"evt")||!id(e.account,"acct")
 ||!Number.isSafeInteger(e.created)||(e.created as number)<0)return null;
 if(!e.data||typeof e.data!=="object")return null;
 const obj=(e.data as Record<string,unknown>).object as Record<string,unknown>|undefined;
 if(!obj||typeof obj!=="object")return null;
 if(!id(obj.payment_intent,"pi")||!Number.isSafeInteger(obj.amount)
 ||(obj.amount as number)<1)return null;
 if(["refund.created","refund.updated","refund.failed"].includes(String(e.type))){
  if(obj.object!=="refund"||!id(obj.id,"re"))return null;
  const status= obj.status==="requires_action"?"pending":obj.status;
  if(!["pending","succeeded","failed","canceled"].includes(String(status)))return null;
  return {eventId:e.id as string,kind:"refund",objectId:obj.id as string,
   accountId:e.account as string,paymentIntentId:obj.payment_intent as string,
   amountCents:obj.amount as number,status:status as "pending"|"succeeded"|"failed"|"canceled",
   providerCreated:e.created as number};
 }
 if(["charge.dispute.created","charge.dispute.updated","charge.dispute.closed"].includes(String(e.type))){
  if(obj.object!=="dispute"||!id(obj.id,"dp"))return null;
  const status=obj.status==="won"?"won":obj.status==="lost"?"lost":
   ["needs_response","under_review","warning_needs_response","warning_under_review"].includes(String(obj.status))?"open":null;
  if(!status)return null;
  return {eventId:e.id as string,kind:"dispute",objectId:obj.id as string,
   accountId:e.account as string,paymentIntentId:obj.payment_intent as string,
   amountCents:obj.amount as number,status,
   providerCreated:e.created as number};
 }
 return null;
}
