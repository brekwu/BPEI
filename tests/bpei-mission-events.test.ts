import test from "node:test";
import assert from "node:assert/strict";
import {missionEventDescription,filterMissionStatus} from "../src/lib/bpei-mission-events.ts";

test("creation event uses actual initial mission status",()=>{
 assert.equal(missionEventDescription({previous_status:null,new_status:"new"}),"Mission créée — Nouvelle mission");
 assert.equal(missionEventDescription({previous_status:null,new_status:"completed"}),"Mission créée — Terminée");
});
test("history labels report both statuses and tolerate unknown states",()=>{
 assert.equal(missionEventDescription({previous_status:"accepted",new_status:"in_progress"}),"Acceptée → En cours");
 assert.match(missionEventDescription({previous_status:"invalid",new_status:"completed"}),/Statut inconnu/);
});
test("mission dashboard filters are exact and default to all",()=>{
 assert.equal(filterMissionStatus("accepted","all"),true);
 assert.equal(filterMissionStatus("completed","completed"),true);
 assert.equal(filterMissionStatus("accepted","completed"),false);
 assert.equal(filterMissionStatus("completed","bogus"),false);
});
