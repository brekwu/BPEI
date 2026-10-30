import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const form=readFileSync(new URL("../src/components/admin/AdminPrivateIntake.tsx",import.meta.url),"utf8");
const browser=readFileSync(new URL("../scripts/browser-mvp-manual-intake-smoke.mjs",import.meta.url),"utf8");

test("Private customer intake never retries an uncertain network response automatically",()=>{
 for(const required of [
  "const inFlight=useRef(false)",
  "const [uncertain,setUncertain]=useState(false)",
  "if(busy||inFlight.current||uncertain)return",
  "inFlight.current=true",
  "inFlight.current=false",
  'if(["42501","22023","23514"].includes(String(e.code)))',
  "setUncertain(true)",
  "Vérification du dossier requise",
  "Vérifiez la liste avant toute nouvelle tentative",
  "J'ai vérifié : autoriser une nouvelle tentative"
 ]) assert.ok(form.includes(required),"Missing intake safety behavior: "+required);
 assert.ok(form.includes("try{onCreated()}catch"),"A view reload failure cannot retroactively fail a committed creation");
 assert.match(form,/disabled=\{busy\|\|uncertain\|\|!draft\.consent_accepted/);
});

test("Browser scenario simulates a committed write whose acknowledgement is lost",()=>{
 for(const required of [
  'route.abort("failed")',
  "dropNextAck=true",
  "assert.equal(attempts,3);assert.equal(created,2)",
  "Checking the dossier must never resubmit a customer write",
  "ackLostNoAutomaticRetry:true"
 ])assert.ok(browser.includes(required),"Missing lost-ack browser regression: "+required);
});
