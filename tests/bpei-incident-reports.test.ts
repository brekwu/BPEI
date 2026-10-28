import test from "node:test";
import assert from "node:assert/strict";
import {
 escapeCsvCell,exportIncidentCsv,buildIncidentResolutionReport,
 validStatisticsPeriod,formatDurationHours,EXPORT_MAX_ROWS
} from "../src/lib/bpei-incident-reports.ts";

test("statistics periods limited to 7 30 90 days",()=>{
 assert.equal(validStatisticsPeriod(7),true);
 assert.equal(validStatisticsPeriod(30),true);
 assert.equal(validStatisticsPeriod(90),true);
 assert.equal(validStatisticsPeriod(1),false);
 assert.equal(validStatisticsPeriod(91),false);
 assert.equal(EXPORT_MAX_ROWS,1000);
});
test("CSV escaping prevents formula injection and protects multiline values",()=>{
 assert.equal(escapeCsvCell("=1+1"),'"\'=1+1"');
 assert.equal(escapeCsvCell("+SUM(A1)"),'"\'+SUM(A1)"');
 assert.equal(escapeCsvCell("-2"),'"\'-2"');
 assert.equal(escapeCsvCell("@HYPERLINK"),'"\'@HYPERLINK"');
 assert.equal(escapeCsvCell("  =cmd"),'"\'  =cmd"');
 assert.equal(escapeCsvCell('Text;"quoted"'),'"Text;""quoted"""');
 assert.equal(escapeCsvCell("line\nnew"),'"line\nnew"');
 assert.equal(escapeCsvCell(null),'""');
});
test("CSV includes explicit headers with no truncated or altered row content",()=>{
 const csv=exportIncidentCsv([{
  id:"incident-1",request_id:"request-1",category:"technical",status:"resolved",
  priority:"critical",created_at:"2026-10-28T12:00:00Z",
  reviewed_at:"2026-10-28T14:00:00Z",target_at:"2026-10-28T18:00:00Z",
  assigned_admin_id:null,resolution_note:"=danger"
 }]);
 assert.ok(csv.startsWith("\uFEFF"));
 assert.ok(csv.includes('"Compte rendu"'));
 assert.ok(csv.includes('"\'=danger"'));
 assert.ok(csv.endsWith("\r\n"));
});
test("resolution report is comprehensive and keeps internal warning",()=>{
 const report=buildIncidentResolutionReport({
  id:"abc",request_id:"mission",category:"technical",status:"resolved",
  priority:"high",description:"La connexion du site était instable.",
  created_at:"2026-10-28T12:00:00Z",reviewed_at:"2026-10-28T14:00:00Z",
  target_at:"2026-10-28T20:00:00Z",resolution_note:"Configuration réseau corrigée."
 },[{event_kind:"status",created_at:"2026-10-28T14:00:00Z",
  previous_status:"under_review",new_status:"resolved",
  previous_priority:null,new_priority:null,reason:null}]);
 assert.ok(report.includes("Document confidentiel"));
 assert.ok(report.includes("Configuration réseau corrigée."));
 assert.ok(report.includes("HISTORIQUE DES DÉCISIONS"));
 assert.ok(report.includes("statut resolved"));
 assert.equal(formatDurationHours(null),"Aucune résolution");
});
