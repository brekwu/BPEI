import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {hasUnresolvedLegalMarkers} from "../src/lib/bpei-legal-document-guards.ts";

const migration=readFileSync(new URL("../supabase/migrations/20261101003701_p0_reject_unresolved_legal_document_markers.sql",import.meta.url),"utf8");
const admin=readFileSync(new URL("../src/components/admin/AdminLegalDocuments.tsx",import.meta.url),"utf8");

test("draft markers and legal placeholders are blocked locally",()=>{
 for(const text of [
  "[À COMPLÉTER : nom et prénom]",
  "[À VALIDER : contrat partenaire]",
  "[A COMPLETER : entreprise]",
  "[À DÉSIGNER : médiateur]",
  "[À CONFIRMER : adresse]",
  "[À VÉRIFIER : règles applicables]",
  "[TODO: verify details]",
  "[TBD]",
  "[placeholder]",
  "[to complete: administrator]",
  "BROUILLON NON PUBLIABLE",
  "TEXTE PROVISOIRE",
  "NE PAS PUBLIER"
 ])assert.equal(hasUnresolvedLegalMarkers("Texte légal. "+text+" Suite."),true,"Unfinished: "+text);
 assert.equal(hasUnresolvedLegalMarkers("Contrat et politique définitifs, datés et approuvés."+"Texte complet. ".repeat(30)),false);
});

test("database independently prevents storage of placeholder documents",()=>{
 assert.match(migration,/CREATE OR REPLACE FUNCTION bpei_private\.has_unresolved_legal_markers/);
 assert.match(migration,/ADD CONSTRAINT bpei_legal_content_without_draft_markers/);
 assert.match(migration,/NOT bpei_private\.has_unresolved_legal_markers\(content\)/);
 assert.match(migration,/REVOKE ALL ON FUNCTION bpei_private\.has_unresolved_legal_markers/);
});

test("admin UI refuses approval and publication of known unfinished drafts",()=>{
 assert.match(admin,/hasUnresolvedLegalMarkers\(content\)\)return/);
 assert.match(admin,/docs\.some\(d=>hasUnresolvedLegalMarkers\(d\.content\)\)\)return/);
 assert.ok((admin.match(/hasUnresolvedLegalMarkers\(/g)||[]).length>=5);
 assert.match(admin,/Brouillon incomplet : remplacez toutes les mentions provisoires/);
});

test("the prepared legal drafts are deliberately unpublishable",()=>{
 for(const kind of ["mentions-legales","confidentialite","cgu"]){
  const text=readFileSync(new URL(`../docs/p0/legal-drafts/${kind}.txt`,import.meta.url),"utf8");
  assert.ok(hasUnresolvedLegalMarkers(text),"Missing placeholder in draft "+kind);
 }
});
