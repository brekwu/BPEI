import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const invoice=readFileSync(new URL("../src/routes/facture.$invoiceId.tsx",import.meta.url),"utf8");
const browser=readFileSync(new URL("../scripts/browser-p0-invoice-signout-smoke.mjs",import.meta.url),"utf8");

test("invoice cannot expose the previous session after sign-out or account switch",()=>{
 for(const snippet of [
  "let requestEpoch=0", "let visibleUserId:string|null=null",
  "function clearInvoice()", "const run=++requestEpoch",
  "const current=()=>active&&run===requestEpoch",
  'event==="SIGNED_OUT"', 'event==="SIGNED_IN"&&session?.user?.id&&session.user.id!==visibleUserId',
  "++requestEpoch;visibleUserId=null", "clearInvoice();setLoading(false)",
  "clearInvoice();setLoading(true)"
 ])assert.ok(invoice.includes(snippet), "Missing invoice session fence: "+snippet);
});

test("all invoice data retrieval must check the active request before rendering",()=>{
 assert.ok((invoice.match(/if\(!current\(\)\)return;/g)||[]).length>=5);
 assert.match(invoice,/if\(current\(\)\)\{\s*setInvoice\(i\);setQuote\(q\)/);
 assert.match(invoice,/return \(\)=>\{\s*active=false;\s*\+\+requestEpoch/);
 assert.match(invoice,/window\.setTimeout\(\(\)=>\{/);
});

test("mock browser scenario holds a private quote until after cross-tab sign-out",()=>{
 assert.match(browser,/await heldQuote/);
 assert.match(browser,/getByRole\("button",\{name:"Se déconnecter"\}\)\.click/);
 assert.match(browser,/getByText\("Session terminée\."\)/);
 assert.match(browser,/allowQuote\(\)/);
 assert.match(browser,/assert\.equal\(await page\.locator\("#bpei-invoice-print"\)\.count\(\),0\)/);
 assert.doesNotMatch(browser,/auth\.admin|service_role|sendEmail|stripe\.charges/);
});
