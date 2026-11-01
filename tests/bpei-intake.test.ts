import test from "node:test";
import assert from "node:assert/strict";
import { validateBpeiInquiry, type BpeiInquiryDraft } from "../src/lib/bpei-intake-validation.ts";

const valid: BpeiInquiryDraft = {
 kind:"intervention",client_name:"  Alice Dupont  ",email:"  ALICE@EXAMPLE.FR  ",
 phone:" 0601020304 ",city:"Nice",address_line1:"12 rue de France",postal_code:"06000",customer_kind:"individual",company_name:"",company_siret:"",subject:"PC portable en panne",
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
test("adresses invalides refusées même si elles contiennent @",()=>{
 for(const email of [
  "person..dot@example.fr","person@example..fr",
  ".person@example.fr","person.@example.fr","person@.example.fr",
  "person@example.fr."
 ])assert.equal(validateBpeiInquiry({...valid,email}).ok,false,email);
});

test("téléphones invalides rejetés avant appel à Supabase",()=>{
 for(const phone of ["ABC1234","0612abc789","123","12345678901234567890","+33 6 11 22 ext.55"])
  assert.equal(validateBpeiInquiry({...valid,phone}).ok,false,phone);
});

test("formats téléphoniques usuels acceptés et contact sans téléphone conservé",()=>{
 for(const phone of ["06 12 34 56 78","+33 (0)6 12 34 56 78","01.23.45.67.89"])
  assert.equal(validateBpeiInquiry({...valid,phone}).ok,true,phone);
 assert.equal(validateBpeiInquiry({...valid,kind:"contact",phone:""}).ok,true);
});

test("nom trop court refusé",()=>assert.equal(validateBpeiInquiry({...valid,client_name:"A"}).ok,false));
test("description trop courte refusée",()=>assert.equal(validateBpeiInquiry({...valid,description:"trop court"}).ok,false));
test("sujet trop long refusé",()=>assert.equal(validateBpeiInquiry({...valid,subject:"x".repeat(161)}).ok,false));
test("type non autorisé refusé",()=>assert.equal(validateBpeiInquiry({...valid,kind:"boutique" as any}).ok,false));
test("description 3000 caractères acceptée",()=>assert.equal(validateBpeiInquiry({...valid,description:"x".repeat(3000)}).ok,true));
test("description au-delà de 3000 refusée",()=>assert.equal(validateBpeiInquiry({...valid,description:"x".repeat(3001)}).ok,false));

test("adresse et téléphone indispensables pour une intervention",()=>{
 assert.equal(validateBpeiInquiry({...valid,phone:""}).ok,false);
 assert.equal(validateBpeiInquiry({...valid,address_line1:""}).ok,false);
 assert.equal(validateBpeiInquiry({...valid,postal_code:"123"}).ok,false);
});
test("facturation entreprise avec raison sociale et SIRET valides",()=>{
 assert.equal(validateBpeiInquiry({...valid,customer_kind:"business",company_name:""}).ok,false);
 assert.equal(validateBpeiInquiry({...valid,customer_kind:"business",company_name:"SARL Test",company_siret:"123"}).ok,false);
 const ok=validateBpeiInquiry({...valid,customer_kind:"business",company_name:"SARL Test",company_siret:"12345678901234"});
 assert.equal(ok.ok,true);
 if(ok.ok)assert.equal(ok.data.company_name,"SARL Test");
});
