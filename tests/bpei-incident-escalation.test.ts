import test from "node:test";
import assert from "node:assert/strict";
import {incidentPriorityLabel,incidentPriorityIsValid,escalationReasonIsValid,
incidentQueueTitle,incidentIsOverdue} from "../src/lib/bpei-incident-escalation.ts";

test("priorities are explicit, unknown values fail closed",()=>{
 assert.equal(incidentPriorityLabel("critical"),"Critique");
 assert.equal(incidentPriorityLabel("high"),"Haute");
 assert.equal(incidentPriorityLabel("suspicious"),"Non reconnue");
 assert.equal(incidentPriorityIsValid("critical"),true);
 assert.equal(incidentPriorityIsValid("suspicious"),false);
});
test("priority change requires a meaningful bounded explanation",()=>{
 assert.equal(escalationReasonIsValid("too short"),false);
 assert.equal(escalationReasonIsValid("Incident nécessitant une intervention prioritaire."),true);
 assert.equal(escalationReasonIsValid(" ".repeat(50)),false);
 assert.equal(escalationReasonIsValid("x".repeat(501)),false);
});
test("overdue excludes closed incidents and invalid dates",()=>{
 const now=new Date("2026-10-28T18:00:00Z").getTime();
 assert.equal(incidentIsOverdue("2026-10-28T17:00:00Z","open",now),true);
 assert.equal(incidentIsOverdue("2026-10-29T17:00:00Z","open",now),false);
 assert.equal(incidentIsOverdue("2026-10-28T17:00:00Z","resolved",now),false);
 assert.equal(incidentIsOverdue("not-a-date","open",now),false);
 assert.equal(incidentQueueTitle("unassigned"),"Non attribués");
});
