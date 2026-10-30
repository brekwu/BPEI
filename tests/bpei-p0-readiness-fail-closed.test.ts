import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const src=readFileSync(new URL("../src/components/admin/AdminP0Readiness.tsx",import.meta.url),"utf8");
const browser=readFileSync(new URL("../scripts/browser-p0-readiness-recheck-smoke.mjs",import.meta.url),"utf8");

test("P0 readiness private state is cleared on failed and superseded reads",()=>{
 for(const term of [
  "const mounted=useRef(false)",
  "const readEpoch=useRef(0)",
  "const run=++readEpoch.current",
  "mounted.current&&run===readEpoch.current",
  "setData(null)",
  "setReferences({})",
  "if(!current())return false",
  "clearPrivateData()",
  "return ()=>{mounted.current=false;++readEpoch.current;}",
  "if(!confirmed)return"
 ])assert.ok(src.includes(term),"Missing fail-closed P0 guard: "+term);
 assert.doesNotMatch(src,/load\(\)\.catch/);
});

test("P0 attestation cannot claim success without authorized readback",()=>{
 assert.match(src,/const confirmed=await load\(\)/);
 assert.match(src,/if\(!confirmed\)return/);
 assert.match(src,/if\(mounted\.current\)setBusy\(false\)/);
 assert.match(browser,/Readiness failure must clear previously displayed positive status/);
 assert.match(browser,/stale readiness response resurrected a prior approved status/);
});
