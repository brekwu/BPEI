import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src=readFileSync(new URL("../src/components/admin/AdminInquiries.tsx",import.meta.url),"utf8");

test("Client-inquiry reads fail closed and cannot resurrect stale client identities",()=>{
 for(const guard of [
  "const mounted=useRef(false)",
  "const readEpoch=useRef(0)",
  "const run=++readEpoch.current",
  "const current=()=>mounted.current&&run===readEpoch.current",
  "if(!current())return false",
  "clearPrivateData()",
  "setInquiries([]);setTechnicians([]);setMissionStatus({});setSelection({})",
  "return ()=>{mounted.current=false;++readEpoch.current;}",
  "!loading&&inquiries.map("
 ])assert.ok(src.includes(guard),"Missing stale-data barrier: "+guard);
});

test("Assign and close actions always release busy lock after network exceptions",()=>{
 for(const operation of ["assign_bpei_inquiry","close_bpei_inquiry"])
  assert.ok(src.includes(operation),"Missing RPC: "+operation);
 assert.ok((src.match(/finally\{\s*if\(mounted\.current\)setBusy\(null\);/g)||[]).length===2,
  "Every mutation must restore the action button after an exception");
 assert.ok((src.match(/if\(!\(await refresh\(\)\)&&mounted\.current\)/g)||[]).length===2);
 assert.match(src,/Attribution non confirmée\. Actualisez le dossier avant toute nouvelle tentative/);
 assert.match(src,/Clôture non confirmée\. Actualisez le dossier avant toute nouvelle tentative/);
});
