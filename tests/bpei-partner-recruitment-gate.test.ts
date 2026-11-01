import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canRegisterIndependent} from "../src/lib/bpei-launch-policy.ts";

const source=readFileSync(new URL("../src/routes/devenir-partenaire.tsx",import.meta.url),"utf8");
const closed=readFileSync(new URL("../scripts/browser-smoke.mjs",import.meta.url),"utf8");
const opened=readFileSync(new URL("../scripts/browser-open-flow-smoke.mjs",import.meta.url),"utf8");

test("Recruitment CTA depends on both published legal documents and the signup flag",()=>{
 assert.equal(canRegisterIndependent(null),false);
 assert.equal(canRegisterIndependent({legal_documents_published:false,independent_registration_enabled:true,legal_version:"v1-2026"}),false);
 assert.equal(canRegisterIndependent({legal_documents_published:true,independent_registration_enabled:false,legal_version:"v1-2026"}),false);
 assert.equal(canRegisterIndependent({legal_documents_published:true,independent_registration_enabled:true,legal_version:null}),false);
 assert.equal(canRegisterIndependent({legal_documents_published:true,independent_registration_enabled:true,legal_version:"v1-2026"}),true);
});

test("Partner route never advertises open signup before verified readback",()=>{
 assert.match(source,/useState<RecruitmentAvailability>\("checking"\)/);
 assert.match(source,/\.select\("legal_documents_published,independent_registration_enabled,legal_version"\)/);
 assert.match(source,/!error&&canRegisterIndependent\(data as any\)\?"open":"closed"/);
 assert.match(source,/\.catch\(\(\)=>\{if\(alive\)setRecruitment\("closed"\);\}\)/);
 assert.match(source,/const open=recruitment==="open"/);
 assert.ok((source.match(/open\?"Déposer ma candidature":"Accéder à l'espace indépendant"/g)||[]).length===2);
 assert.doesNotMatch(source,/Candidatez dès maintenant/);
});

test("Browser smoke checks both closed and open registration states",()=>{
 assert.match(closed,/await open\("\/devenir-partenaire"/);
 assert.match(closed,/Closed signup must not be advertised as open/);
 assert.match(opened,/testPage\("\/devenir-partenaire"\)/);
 assert.match(opened,/Open registration must not show a closed-signup call to action/);
});
