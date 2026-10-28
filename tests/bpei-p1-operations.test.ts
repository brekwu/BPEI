import test from "node:test";
import assert from "node:assert/strict";
import {canReportMissionIncident,canReviewIncident,validIncidentDescription,incidentStatusLabel} from "../src/lib/bpei-p1-operations.ts";
test("seules les missions actives peuvent signaler",()=>{
 for(const s of ["new","cancelled","completed","invalid"])assert.equal(canReportMissionIncident(s),false);
 for(const s of ["accepted","in_progress"])assert.equal(canReportMissionIncident(s),true);
});
test("description entre 30 et 2000 caractères",()=>{
 assert.equal(validIncidentDescription(" ".repeat(50)),false);
 assert.equal(validIncidentDescription("x".repeat(29)),false);
 assert.equal(validIncidentDescription("x".repeat(30)),true);
 assert.equal(validIncidentDescription("x".repeat(2001)),false);
});
test("transitions et note de résolution contrôlées",()=>{
 assert.equal(canReviewIncident("open","under_review",""),true);
 assert.equal(canReviewIncident("under_review","resolved","Mesures de résolution appliquées"),true);
 assert.equal(canReviewIncident("open","resolved","court"),false);
 assert.equal(canReviewIncident("resolved","open",""),false);
 assert.equal(canReviewIncident("under_review","open",""),false);
 assert.equal(incidentStatusLabel("unknown"),"Statut inconnu");
});
