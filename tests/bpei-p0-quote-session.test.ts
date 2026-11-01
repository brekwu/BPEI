import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const quote=readFileSync(new URL("../src/routes/devis.$quoteId.tsx",import.meta.url),"utf8");
const browser=readFileSync(new URL("../scripts/browser-p0-quote-signout-smoke.mjs",import.meta.url),"utf8");

test("quote cannot expose the previous session after cross-tab signout or account switch",()=>{
 for(const guard of [
  "let requestEpoch=0",
  "let visibleUserId:string|null=null",
  "function clearQuote()",
  "const run=++requestEpoch",
  "const current=()=>active&&run===requestEpoch",
  'event==="SIGNED_OUT"',
  'event==="SIGNED_IN"&&session?.user?.id&&session.user.id!==visibleUserId',
  "++requestEpoch;visibleUserId=null",
  "clearQuote();setLoading(false)",
  "clearQuote();setLoading(true)",
  "subscription.unsubscribe()"
 ])assert.ok(quote.includes(guard),"Missing quote privacy guard: "+guard);
});
test("late quote reads cannot render or print a stale customer's details",()=>{
 assert.ok((quote.match(/if\(!current\(\)\)return;/g)||[]).length>=2);
 assert.match(quote,/if\(!current\(\)\)return;\s*if\(e\|\|!data\)/);
 assert.match(quote,/return \(\)=>\{\s*active=false;\s*\+\+requestEpoch/);
 assert.match(browser,/await heldQuote/);
 assert.match(browser,/getByRole\("button",\{name:"Se déconnecter"\}\)\.click/);
 assert.match(browser,/allowQuote\(\)/);
 assert.match(browser,/Quote personal data resurrected after cross-tab sign-out/);
 assert.doesNotMatch(browser,/auth\.admin|service_role|sendEmail|stripe\.charges/);
});
