import test from "node:test";
import assert from "node:assert/strict";
import { missionStatusLabel, nextMissionStatus, canReadMissionClientContact } from "../src/lib/bpei-mission-status.ts";

test("new mission is not started and does not expose contact",()=>{
 assert.equal(missionStatusLabel("new"),"Nouvelle mission");
 assert.equal(nextMissionStatus("new"),null);
 assert.equal(canReadMissionClientContact("new"),false);
});
test("accepted mission may start and reveal contact",()=>{
 assert.equal(missionStatusLabel("accepted"),"Acceptée");
 assert.equal(nextMissionStatus("accepted"),"in_progress");
 assert.equal(canReadMissionClientContact("accepted"),true);
});
test("in-progress mission may be completed",()=>{
 assert.equal(missionStatusLabel("in_progress"),"En cours");
 assert.equal(nextMissionStatus("in_progress"),"completed");
 assert.equal(canReadMissionClientContact("in_progress"),true);
});
test("completed mission cannot progress further",()=>{
 assert.equal(missionStatusLabel("completed"),"Terminée");
 assert.equal(nextMissionStatus("completed"),null);
 assert.equal(canReadMissionClientContact("completed"),true);
});
test("cancelled mission cannot progress or reveal contact",()=>{
 assert.equal(missionStatusLabel("cancelled"),"Refusée / annulée");
 assert.equal(nextMissionStatus("cancelled"),null);
 assert.equal(canReadMissionClientContact("cancelled"),false);
});
test("unknown status is denied by default",()=>{
 assert.equal(missionStatusLabel("approved"),"Statut inconnu");
 assert.equal(nextMissionStatus("approved"),null);
 assert.equal(canReadMissionClientContact("approved"),false);
});
test("empty status is denied",()=>{
 assert.equal(missionStatusLabel(""),"Statut inconnu");
 assert.equal(nextMissionStatus(""),null);
 assert.equal(canReadMissionClientContact(""),false);
});
