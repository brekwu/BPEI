import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const file=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const legal=file("src/components/public/PublishedBpeiLegalPage.tsx");
const signup=file("src/routes/espace-independant.tsx");
const intake=file("src/components/public/BpeiIntakeForm.tsx");

test("three legal routes use versioned published legal docs",()=>{
 for(const kind of ["mentions-legales","confidentialite","cgu"]){
  const page=file("src/routes/"+kind+".tsx");
  assert.match(page,/PublishedBpeiLegalPage/);
  assert.ok(page.includes('kind="'+kind+'"'));
 }
});
test("legal pages fetch only approved version from Supabase",()=>{
 assert.match(legal,/bpei_launch_controls/);
 assert.match(legal,/bpei_legal_documents/);
 assert.match(legal,/legal_documents_published/);
 assert.match(legal,/eq\("version",gate\.data\.legal_version\)/);
});
test("legal documents are rendered as escaped React text not raw HTML",()=>{
 assert.match(legal,/\{document\.content\}/);
 assert.doesNotMatch(legal,/dangerouslySetInnerHTML/);
});
test("customer forms require both an enabled flag and legal publication",()=>{
 assert.match(intake,/bpei_intake_flags/);
 assert.match(intake,/bpei_launch_controls/);
 assert.match(intake,/flag\.data\?\.enabled===true && legal\.data\?\.legal_documents_published===true/);
});
test("signup points confirmation back to the independent space",()=>{
 assert.match(signup,/emailRedirectTo:.*espace-independant/);
 assert.match(signup,/canRegisterIndependent\(launch\)/);
});
test("profile creation checks accepted legal version",()=>{
 assert.match(signup,/disabled=\{saving \|\| !legalAccepted\}/);
 assert.match(signup,/bpei_legal_acceptances/);
});
