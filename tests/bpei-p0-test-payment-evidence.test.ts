import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {findConfirmedTestPayment} from "../src/lib/bpei-test-payment-evidence.ts";

const paid={id:"ledger-1",invoice_id:"invoice-1",state:"paid",paid_at:"2026-10-30T12:00:00Z",amount_cents:10800,application_fee_cents:2000};
test("A webhook-confirmed TEST payment is shown despite immutable invoice status",()=>{
 assert.equal(findConfirmedTestPayment("invoice-1",10800,[paid]),paid);
});
test("Unverified, incomplete, mismatched and missing TEST ledger evidence never counts as paid",()=>{
 const bad=[
  {...paid,state:"pending"},
  {...paid,state:"open"},
  {...paid,state:"failed"},
  {...paid,paid_at:null},
  {...paid,paid_at:""},
  {...paid,amount_cents:10799},
  {...paid,amount_cents:10801},
  {...paid,invoice_id:"invoice-other"}
 ];
 for(const attempt of bad)
  assert.equal(findConfirmedTestPayment("invoice-1",10800,[attempt]),undefined,JSON.stringify(attempt));
 assert.equal(findConfirmedTestPayment(null,10800,[paid]),undefined);
 assert.equal(findConfirmedTestPayment("invoice-1",0,[paid]),undefined);
 assert.equal(findConfirmedTestPayment("invoice-1",NaN,[paid]),undefined);
 assert.equal(findConfirmedTestPayment("invoice-1",10800,[]),undefined);
 assert.equal(findConfirmedTestPayment("invoice-1",10800,[bad[0],bad[5],paid]),paid);
});
test("Commercial screen does not rely on mutable invoice.payment_status",()=>{
 const src=readFileSync(new URL("../src/components/admin/AdminCommercialDesk.tsx",import.meta.url),"utf8");
 assert.match(src,/findConfirmedTestPayment\(invoice\?\.id,q\.gross_cents,payments\)/);
 assert.doesNotMatch(src,/invoice\?\.payment_status\s*===\s*["']paid["']/);
 const smoke=readFileSync(new URL("../scripts/browser-mvp-commercial-smoke.mjs",import.meta.url),"utf8");
 assert.match(smoke,/payment_status:"unpaid"/);
 assert.match(smoke,/Paiement Stripe confirmé \(TEST uniquement\)/);
});
