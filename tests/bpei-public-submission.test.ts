import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyPublicInquiryFailure } from "../src/lib/bpei-public-submission.ts";

test("public intake distinguishes definite denial from lost acknowledgement",()=>{
  assert.equal(classifyPublicInquiryFailure({code:"42501"}),"rejected");
  assert.equal(classifyPublicInquiryFailure({code:"23514"}),"rejected");
  assert.equal(classifyPublicInquiryFailure({code:"22023",message:"Invalid request"}),"rejected");
  assert.equal(classifyPublicInquiryFailure({code:"22023",message:"Duplicate inquiry; use the existing request"}),"uncertain");
  for(const error of [null,{},new Error("network error"),{code:"PGRST500"},{code:"23505"}]){
    assert.equal(classifyPublicInquiryFailure(error),"uncertain");
  }
});

test("public form locks double submit and lost-ack retries, then releases busy on all paths",()=>{
  const src=readFileSync(new URL("../src/components/public/BpeiIntakeForm.tsx",import.meta.url),"utf8");
  for(const s of [
    "const inFlight=useRef(false)",
    "const [uncertain,setUncertain] = useState(false)",
    "if(saving||inFlight.current||uncertain)return",
    "inFlight.current=true",
    "setUncertain(true)",
    "Ne l'envoyez pas de nouveau",
    "disabled={saving||uncertain}",
    "inFlight.current=false",
    "setSaving(false)",
    "classifyPublicInquiryFailure(error)"
  ]) assert.ok(src.includes(s),"Missing public intake safety guard: "+s);
  assert.match(src,/catch\{/);
  assert.match(src,/finally\{/);
});
