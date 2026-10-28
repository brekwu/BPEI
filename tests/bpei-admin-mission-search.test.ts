import test from "node:test";
import assert from "node:assert/strict";
import {ADMIN_MISSION_PAGE_SIZE,countByMissionStatus,missionAttentionLabel,missionPageInfo} from "../src/lib/bpei-admin-mission-search.ts";

const counts={all_count:82,new_count:12,accepted_count:20,in_progress_count:10,completed_count:37,cancelled_count:3,attention_count:8};

test("server pages always use a fixed size and preserve totals",()=>{
 assert.equal(ADMIN_MISSION_PAGE_SIZE,25);
 assert.deepEqual(missionPageInfo(0,82),{from:1,to:25,canPrevious:false,canNext:true});
 assert.deepEqual(missionPageInfo(3,82),{from:76,to:82,canPrevious:true,canNext:false});
 assert.deepEqual(missionPageInfo(0,0),{from:0,to:0,canPrevious:false,canNext:false});
});
test("invalid pagination parameters are rejected",()=>{
 assert.throws(()=>missionPageInfo(-1,10));
 assert.throws(()=>missionPageInfo(0,-1));
 assert.throws(()=>missionPageInfo(0,5,0));
 assert.throws(()=>missionPageInfo(0,5.5));
});
test("status filters use server-provided totals",()=>{
 assert.equal(countByMissionStatus(counts,"all"),82);
 assert.equal(countByMissionStatus(counts,"new"),12);
 assert.equal(countByMissionStatus(counts,"completed"),37);
 assert.equal(countByMissionStatus(counts,"invalid"),0);
});
test("attention reasons are explicit, unknown reasons do not become alerts",()=>{
 assert.equal(missionAttentionLabel("incident_open"),"Incident ouvert");
 assert.equal(missionAttentionLabel("overdue"),"Intervention en retard");
 assert.equal(missionAttentionLabel("awaiting_reply"),"Proposition sans réponse depuis plus de 24 h");
 assert.equal(missionAttentionLabel(null),null);
 assert.equal(missionAttentionLabel("arbitrary"),null);
});
