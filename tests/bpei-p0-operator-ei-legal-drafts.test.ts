import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {hasUnresolvedLegalMarkers} from "../src/lib/bpei-legal-document-guards.ts";

const read=(path:string)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const files=[
 "docs/p0/legal-drafts/mentions-legales.txt",
 "docs/p0/legal-drafts/confidentialite.txt",
 "docs/p0/legal-drafts/cgu.txt"
];
test("Operator drafts use the declared existing EI/micro-enterprise without claiming a separate BPEI legal person",()=>{
 for(const path of files){
  const doc=read(path);
  assert.match(doc,/(entreprise individuelle|entrepreneur individuel)/i,path);
  assert.match(doc,/BPEI/,path);
  assert.match(doc,/HP Informatique/,path);
  assert.equal(hasUnresolvedLegalMarkers(doc),true,"Non-finalized legal drafts must remain unpublishable: "+path);
 }
});
test("Legal identity, VAT and SIRET remain explicitly unresolved until verified",()=>{
 const doc=read(files[0]);
 for(const expected of ["SIREN","SIRET","TVA","[À COMPLÉTER","[À VÉRIFIER","EI"])
  assert.ok(doc.includes(expected),expected);
 assert.doesNotMatch(doc,/BPEI\s+(SAS|SARL|EURL)\b/);
 const convention=read("docs/juridique/CONVENTION-PARTENAIRE-BPEI-BROUILLON.md");
 assert.match(convention,/Titulaire légal/);
 assert.match(convention,/PROJET CONTRACTUEL NON SIGNÉ/);
 assert.match(convention,/SIREN/);
});
test("Future conversion to a company is documented, not silently assumed",()=>{
 const guide=read("docs/p0/EVOLUTION-OPERATEUR-EI.md");
 const launch=read("docs/p0/MISE_EN_SERVICE.md");
 assert.match(guide,/guichet unique/i);
 assert.match(guide,/SIREN/);
 assert.match(guide,/SIRET/);
 assert.match(guide,/apport ou cession/i);
 assert.match(guide,/facture historique/i);
 assert.match(guide,/Stripe Connect\/KYC/);
 assert.match(guide,/non publiable/i);
 assert.match(launch,/micro-entreprise existante/);
 assert.match(launch,/EVOLUTION-OPERATEUR-EI.md/);
});
