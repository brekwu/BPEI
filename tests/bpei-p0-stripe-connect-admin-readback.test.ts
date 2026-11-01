import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isConfirmedTestMerchantApproval} from "../src/lib/bpei-stripe-connect-readback.ts";

const id="77777777-7777-4777-8777-777777777777";
const other="11111111-1111-4111-8111-111111111111";
const approved={id,connected:true,providerChecked:true,approved:true};
const panel=readFileSync(new URL("../src/components/admin/AdminConnectPanel.tsx",import.meta.url),"utf8");

test("Only fresh, complete Stripe TEST merchant readback permits an approved display",()=>{
 assert.equal(isConfirmedTestMerchantApproval([],id),false);
 assert.equal(isConfirmedTestMerchantApproval([approved],id),true);
 assert.equal(isConfirmedTestMerchantApproval([approved],other),false);
 for(const key of ["connected","providerChecked","approved"] as const)
  assert.equal(isConfirmedTestMerchantApproval([{...approved,[key]:false}],id),false,
   "Missing verified field must block approval: "+key);
 assert.equal(isConfirmedTestMerchantApproval([{...approved,id:other}],id),false);
 assert.equal(isConfirmedTestMerchantApproval([{...approved,approved:false},approved],id),true);
});

test("Admin Connect confirms approval only after an authenticated server re-list",()=>{
 assert.match(panel,/const \{data,error\}=await supabase\.functions\.invoke\("bpei-test-connect",\{body:\{action:"approve",issuer_id:id\}\}\)/);
 assert.match(panel,/accepted=true;\s+const list=await readVerifiedTestMerchants\(\);/);
 assert.match(panel,/if\(!isConfirmedTestMerchantApproval\(list,id\)\)/);
 assert.match(panel,/setPeople\(list\);setLoaded\(true\);/);
 assert.doesNotMatch(panel,/setPeople\(x=>x\.map\(/,
  "No optimistic merchant status can be shown without server readback");
});

test("Failed Connect list/write hides previously authorized merchant identities",()=>{
 const clear=panel.match(/setPeople\(\[\]\);setLoaded\(false\)/g)??[];
 assert.ok(clear.length>=4,"Both list and approval must clear old values before/after failure");
 assert.match(panel,/readVerifiedTestMerchants\(\)/);
 assert.match(panel,/Lecture Stripe TEST non confirmée : anciens statuts masqués/);
 assert.match(panel,/Action potentiellement enregistrée, mais impossible à confirmer/);
 assert.match(panel,/disabled=\{busy\|\|!p\.providerChecked\}/);
});
