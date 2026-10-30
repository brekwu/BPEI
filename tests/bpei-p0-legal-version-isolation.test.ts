import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/components/admin/AdminLegalDocuments.tsx",import.meta.url),"utf8");
const browser=readFileSync(new URL("../scripts/browser-p0-legal-version-race-smoke.mjs",import.meta.url),"utf8");

test("Legal approval and publication are locked until the requested version is loaded",()=>{
 assert.match(source,/const \[loadedVersion,setLoadedVersion\]=useState<string\|null>\(null\)/);
 assert.match(source,/if\(busy\|\|loadedVersion!==version\|\|lockedVersions\.includes\(version\)/);
 assert.match(source,/if\(busy\|\|loadedVersion!==version\|\|docs\.length!==3/);
 assert.match(source,/disabled=\{busy\|\|loadedVersion!==version\|\|lockedVersions\.includes\(version\)/);
 assert.match(source,/value=\{version\} disabled=\{busy\}/);
});
test("Asynchronous legal reads cannot overwrite another version's drafts",()=>{
 assert.match(source,/const epoch=\+\+refreshEpoch\.current/);
 assert.match(source,/if\(epoch!==refreshEpoch\.current\|\|latestVersion\.current!==requestedVersion\)return false/);
 assert.match(source,/\+\+refreshEpoch\.current;\s*setLoadedVersion\(null\)/);
 assert.match(source,/setDrafts\(\{"mentions-legales":"","confidentialite":"","cgu":""\}\)/);
 assert.match(source,/setLoadedVersion\(requestedVersion\)/);
});
test("Legal administrator never remains permanently busy after provider exceptions",()=>{
 assert.equal((source.match(/finally\{setBusy\(false\);\}/g)||[]).length,2);
 assert.match(source,/catch\{[\s\S]*?Service juridique indisponible/);
 assert.match(browser,/await firstGate/);
 assert.match(browser,/await secondGate/);
 assert.match(browser,/releaseSecond\(\)/);
 assert.match(browser,/releaseFirst\(\)/);
 assert.match(browser,/Old async read replaced drafts for a different version/);
 assert.doesNotMatch(browser,/auth\.admin|sendEmail|stripe\.charges\.create/);
});

test("Legal admin clears all cached drafts, approvals and publication when access readback fails",()=>{
 for(const guard of [
  "function clearLoadedLegalData()",
  "setDocs([])",
  'setDrafts({"mentions-legales":"","confidentialite":"","cgu":""})',
  "setPublished(null)",
  "setLockedVersions([])",
  "setLoadedVersion(null)",
  "if(d.error||c.error||h.error||!c.data)",
  "clearLoadedLegalData();",
  "return ()=>{++refreshEpoch.current;};",
  'onClick={()=>void refresh()}>Recharger les documents'
 ])assert.ok(source.includes(guard),"Legal readback safety missing: "+guard);
 assert.match(source,/else if\(await refresh\(\)\)setNotice\("Document validé/);
 assert.match(source,/else setNotice\("Validation potentiellement enregistrée/);
 assert.match(source,/else setNotice\("Publication potentiellement enregistrée/);
});
test("Mock browser denies legal readback after successful write and clears previous approval view",()=>{
 for(const guard of [
  "let approveRecorded=false",
  'if(path==="/rest/v1/rpc/approve_bpei_legal_document")',
  "Authorization lost during legal readback",
  "assert.ok(approveRecorded&&deniedLegalReads>=1",
  '"Private legal draft remained visible after an unauthorized readback"',
  '"Stale approval history must not be presented as verified"',
  '"Recharger les documents"'
 ])assert.ok(browser.includes(guard),"Legal browser regression missing: "+guard);
});
