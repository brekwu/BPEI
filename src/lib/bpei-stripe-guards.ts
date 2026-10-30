/**
 * Stripe Connect webhook guards. Works in both Deno Edge Functions and Node tests.
 * The paid state MUST only be written after a verified provider signature.
 */
const encode=new TextEncoder();
export type StripeCheckoutSignal={
 eventId:string;attemptId:string;sessionId:string;connectedAccountId:string;
 amountCents:number;currency:"eur";intentId:string|null;kind:"paid"|"failed"|"expired";
};
function hex(bytes:Uint8Array):string{
 return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
function equalHex(a:string,b:string):boolean{
 if(!/^[0-9a-f]{64}$/i.test(a)||!/^[0-9a-f]{64}$/i.test(b))return false;
 let diff=0;
 for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
export async function verifyStripeSignature(
 raw:string,signature:string,secret:string,nowSeconds=Math.floor(Date.now()/1000)
):Promise<boolean>{
 if(!secret.startsWith("whsec_")||raw.length===0||raw.length>1000000)return false;
 const parts=signature.split(",").map(x=>x.trim());
 const timePart=parts.find(x=>x.startsWith("t="))?.slice(2);
 const t=Number(timePart);
 if(!timePart||!Number.isSafeInteger(t)||Math.abs(nowSeconds-t)>300)return false;
 const v1s=parts.filter(x=>x.startsWith("v1=")).map(x=>x.slice(3));
 if(!v1s.length)return false;
 const key=await crypto.subtle.importKey("raw",encode.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const mac=await crypto.subtle.sign("HMAC",key,encode.encode(t+"."+raw));
 const expected=hex(new Uint8Array(mac));
 return v1s.some(s=>equalHex(expected,s));
}
export function parseStripeCheckoutSignal(value:unknown):StripeCheckoutSignal|null{
 if(!value||typeof value!=="object")return null;
 const event=value as Record<string,unknown>;
 if(event.livemode!==false||typeof event.id!=="string"||!/^evt_[a-zA-Z0-9_]+$/.test(event.id)
 ||typeof event.account!=="string"||!/^acct_[a-zA-Z0-9]+$/.test(event.account))return null;
 const kind=event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded"?"paid":
 event.type==="checkout.session.async_payment_failed"?"failed":
 event.type==="checkout.session.expired"?"expired":null;
 if(!kind)return null;
 const data=event.data;
 if(!data||typeof data!=="object")return null;
 const session=(data as Record<string,unknown>).object as Record<string,unknown>|undefined;
 if(!session||session.object!=="checkout.session"||session.mode!=="payment"
 ||typeof session.id!=="string"||!/^cs_test_[a-zA-Z0-9_]+$/.test(session.id)
 ||session.currency!=="eur"||!Number.isSafeInteger(session.amount_total)
 ||(session.amount_total as number)<100||typeof session.metadata!=="object"||!session.metadata)return null;
 if(kind==="paid"&&session.payment_status!=="paid")return null;
 const metadata=session.metadata as Record<string,unknown>;
 if(typeof metadata.bpei_attempt_id!=="string"
 ||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(metadata.bpei_attempt_id))return null;
 const intent=session.payment_intent;
 if(intent!==null&&intent!==undefined&&(typeof intent!=="string"||!/^pi_[a-zA-Z0-9_]+$/.test(intent)))return null;
 return {eventId:event.id,attemptId:metadata.bpei_attempt_id,
 sessionId:session.id,connectedAccountId:event.account,
 amountCents:session.amount_total as number,currency:"eur",
 intentId:typeof intent==="string"?intent:null,kind};
}
