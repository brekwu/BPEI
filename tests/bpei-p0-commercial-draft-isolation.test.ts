import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../src/components/admin/AdminCommercialDesk.tsx",import.meta.url),"utf8");

test("Quote acceptance evidence is isolated by the exact quote ID",()=>{
 for(const term of [
  "type AcceptanceDraft=", "acceptanceDrafts[quote.id]",
  "acceptanceDrafts[q.id]", "[q.id]:{...acceptanceDraft,method:",
  "[q.id]:{...acceptanceDraft,reference:",
  "p_quote_id:quote.id,p_method:draft.method,p_evidence_reference:draft.reference.trim()",
  "disabled={busy||acceptanceDraft.reference.trim().length<10}"
 ])assert.ok(src.includes(term),"Missing quote-specific evidence guard: "+term);
 assert.doesNotMatch(src,/useState\("email"\).*evidenceMethod|useState\(""\).*evidenceReference/);
});

test("Immutable invoice tax data and conditions are scoped per quote",()=>{
 for(const term of [
  "type InvoiceDraft=", "invoiceDrafts[quote.id]",
  "invoiceDrafts[q.id]", "function updateInvoiceDraft(id:string,patch:Partial<InvoiceDraft>)",
  "value={invoiceDraft.paymentTerms}", "value={invoiceDraft.issuerVatNumber}",
  "invoiceDraft.paymentTerms.trim().length<10",
  "invoiceDraft.issuerVatNumber.trim().toUpperCase()",
  "p_quote_id:quote.id,p_service_date:serviceDate"
 ])assert.ok(src.includes(term),"Missing quote-specific invoice guard: "+term);
 assert.doesNotMatch(src,/setPaymentTerms\(e\.target\.value\)/);
 assert.doesNotMatch(src,/setIssuerVatNumber\(e\.target\.value/);
});

test("The admin must not see a confirmed invoice/quote when post-write readback fails",()=>{
 assert.match(src,/const refresh=useCallback\(async\(\):Promise<boolean>=>\{/);
 assert.match(src,/const refreshed=await refresh\(\)/);
 assert.match(src,/if\(refreshed\)setMessage\(successMessage\)/);
 assert.match(src,/Action potentiellement enregistrée, mais lecture de confirmation indisponible/);
 assert.match(src,/Actualisez le dossier avant toute nouvelle tentative/);
});

test("Stale data and private draft values are purged on a failed commercial refresh",()=>{
 for(const guard of [
  "const mounted=useRef(false)",
  "const refreshEpoch=useRef(0)",
  "const epoch=++refreshEpoch.current",
  "const current=()=>mounted.current&&epoch===refreshEpoch.current",
  "if(!current())return false",
  "if(current()){",
  "setAcceptanceDrafts({});setInvoiceDrafts({});",
  "setTestLink(null);setInquiryId(\"\");",
  "mounted.current=false;",
  "++refreshEpoch.current;"
 ])assert.ok(src.includes(guard),"Missing commercial privacy boundary: "+guard);
 assert.match(src,/finally\{if\(current\(\)\)setLoading\(false\);\}/);
});
