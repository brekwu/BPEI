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

test("Dated INPI/URSSAF evidence fills only operator facts and never silently validates the BPEI activity",()=>{
 const mentions=read(files[0]);
 const confidentiality=read(files[1]);
 const cgu=read(files[2]);
 const provenance=read("docs/p0/IDENTITE-SOURCES-2026-11-01.md");
 for(const txt of [mentions,confidentiality,cgu]){
  assert.match(txt,/105\s?370\s?001/);
  assert.match(txt,/2026/);
  assert.match(txt,/\[À VÉRIFIER/);
  assert.equal(hasUnresolvedLegalMarkers(txt),true);
 }
 assert.match(mentions,/142 rue de Rivoli/i);
 assert.match(mentions,/URSSAF d'août 2026/);
 assert.match(mentions,/4791B/);
 assert.match(mentions,/franchise en base de TVA/);
 assert.match(provenance,/activité initiale/i);
 assert.match(provenance,/n'est pas attesté comme déclaré/i);
 assert.match(provenance,/ne jamais les copier dans ce dépôt/i);
});
