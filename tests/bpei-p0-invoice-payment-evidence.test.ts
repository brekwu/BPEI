import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {findConfirmedTestPayment} from "../src/lib/bpei-test-payment-evidence.ts";

const invoice=readFileSync(new URL("../src/routes/facture.$invoiceId.tsx",import.meta.url),"utf8");
const scenario=readFileSync(new URL("../scripts/browser-mvp-commercial-smoke.mjs",import.meta.url),"utf8");

test("invoice PDF uses the same server-verified TEST ledger evidence as admin",()=>{
 for(const guard of [
  'findConfirmedTestPayment(i.id,q.gross_cents,paymentRows??[])',
  '.select("id,invoice_id,state,paid_at,amount_cents,created_at")',
  '.order("created_at",{ascending:false}).limit(50)',
  'setTestPaymentConfirmed(!!confirmed)',
  '.eq("attempt_id",confirmed.id)'
 ])assert.ok(invoice.includes(guard),"Missing invoice TEST payment guard: "+guard);
 assert.doesNotMatch(invoice,/setTestPaymentConfirmed\(\(verified\?\?\[\]\)\.length>0\)/);
 assert.doesNotMatch(invoice,/if\(verified\?\.\[0\]\)/);
});
test("Only matching amount, invoice, timestamp and signed-paid state count",()=>{
 const row={id:"paid-1",invoice_id:"invoice-1",state:"paid",paid_at:"2026-10-30T12:00:00Z",amount_cents:10800};
 assert.equal(findConfirmedTestPayment("invoice-1",10800,[row]),row);
 for(const mismatch of [
  {...row,amount_cents:10799},
  {...row,amount_cents:10801},
  {...row,paid_at:null},
  {...row,invoice_id:"another-invoice"},
  {...row,state:"pending"},
  {...row,state:"failed"}
 ])assert.equal(findConfirmedTestPayment("invoice-1",10800,[mismatch]),undefined);
});
test("browser regression includes mismatched TEST payment followed by a valid one",()=>{
 assert.match(scenario,/stripeTestEvidence\.amount_cents=10799/);
 assert.match(scenario,/Non confirmé \/ impayé/);
 assert.match(scenario,/stripeTestEvidence\.amount_cents=10800/);
 assert.match(scenario,/PAIEMENT SIMULÉ CONFIRMÉ \(Stripe TEST\)/);
 assert.match(scenario,/payment_status:"unpaid"/);
});
