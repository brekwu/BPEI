import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
test("Deployed webhook guard must match the exercised pure TypeScript helper",()=>{
 const src=readFileSync(new URL("../src/lib/bpei-stripe-guards.ts",import.meta.url),"utf8");
 const edge=readFileSync(new URL("../supabase/functions/bpei-test-webhook/stripe-guards.ts",import.meta.url),"utf8");
 assert.equal(edge,src);
});
test("Test-only Stripe integration cannot accidentally accept live keys or public browser amounts",()=>{
 const checkout=readFileSync(new URL("../supabase/functions/bpei-test-checkout/index.ts",import.meta.url),"utf8");
 const webhook=readFileSync(new URL("../supabase/functions/bpei-test-webhook/index.ts",import.meta.url),"utf8");
 for(const flag of ["BPEI_TEST_CHECKOUT_ENABLED","sk_test_","mvp_test_checkout_prepare","mvp_test_checkout_attach","mvp_test_checkout_abort","Stripe-Account"])assert.ok(checkout.includes(flag),flag);
 assert.equal(checkout.includes("sk_live_"),false);
 assert.ok(checkout.includes("invoice_id"));
 assert.equal(checkout.includes("payload.amount"),false);
 for(const flag of ["BPEI_STRIPE_CONNECT_WEBHOOK_SECRET","verifyStripeSignature","parseStripeCheckoutSignal","mvp_test_checkout_webhook"])assert.ok(webhook.includes(flag),flag);
});

test("A Stripe test link is presented to the operator, never auto-paid by redirecting the administrator",()=>{
 const component=readFileSync(new URL("../src/components/admin/AdminCommercialDesk.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(component,/window\.location\.assign\(/);
 assert.match(component,/Lien de paiement Stripe TEST/);
 assert.match(component,/testLink/);
 assert.match(component,/rel="noopener noreferrer"/);
});
