import test from "node:test";
import assert from "node:assert/strict";
import { validateBpeiInquiry, type BpeiInquiryDraft } from "../src/lib/bpei-intake-validation.ts";

const valid: BpeiInquiryDraft = {
 kind:"intervention",client_name:"  Alice Dupont  ",email:"  ALICE@EXAMPLE.FR  ",
 phone:" 0601020304 ",city:"Nice",subject:"PC portable en panne",
 description:"Le PC ne démarre plus depuis ce matin.",consent_accepted:true
};
test("demande d'intervention valide normalisée",()=>{
 const r=validateBpeiInquiry(valid);
 assert.equal(r.ok,true);
 if(r.ok){assert.equal(r.data.client_name,"Alice Dupont");assert.equal(r.data.email,"alice@example.fr");assert.equal(r.data.phone,"0601020304");assert.equal(r.data.kind,"intervention")}
});
test("contact sans ville ni téléphone accepté",()=>{
 const r=validateBpeiInquiry({...valid,kind:"contact",phone:"",city:""});
 assert.equal(r.ok,true);if(r.ok){assert.equal(r.data.city,null);assert.equal(r.data.phone,null)}
});
test("intervention sans ville refusée",()=>assert.equal(validateBpeiInquiry({...valid,city:" "}).ok,false));
test("consentement manquant refusé",()=>assert.equal(validateBpeiInquiry({...valid,consent_accepted:false}).ok,false));
test("e-mail invalide refusé",()=>assert.equal(validateBpeiInquiry({...valid,email:"foo.example.fr"}).ok,false));
test("nom trop court refusé",()=>assert.equal(validateBpeiInquiry({...valid,client_name:"A"}).ok,false));
test("description trop courte refusée",()=>assert.equal(validateBpeiInquiry({...valid,description:"trop court"}).ok,false));
test("sujet trop long refusé",()=>assert.equal(validateBpeiInquiry({...valid,subject:"x".repeat(161)}).ok,false));
test("type non autorisé refusé",()=>assert.equal(validateBpeiInquiry({...valid,kind:"boutique" as any}).ok,false));
test("description 3000 caractères acceptée",()=>assert.equal(validateBpeiInquiry({...valid,description:"x".repeat(3000)}).ok,true));
test("description au-delà de 3000 refusée",()=>assert.equal(validateBpeiInquiry({...valid,description:"x".repeat(3001)}).ok,false));
