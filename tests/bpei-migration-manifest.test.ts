import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";

const migrations=readdirSync(new URL("../supabase/migrations/",import.meta.url))
 .filter(name=>name.endsWith(".sql")).sort();
const readme=readFileSync(new URL("../supabase/README.md",import.meta.url),"utf8");

test("Every applied Supabase migration is present exactly once in the repository",()=>{
 assert.equal(migrations.length,38,"Migration 38 and earlier must be committed to GitHub");
 assert.equal(new Set(migrations.map(name=>name.slice(0,14))).size,38,
  "Supabase migration timestamps must be unique");
 assert.ok(migrations.every((name,index)=>index===0||name>migrations[index-1]),
  "Migration files must have monotonic names");
 assert.match(readme,/38 migrations appliquées/);
 assert.match(readme,/38 fichiers SQL versionnés/);
 assert.ok(migrations.some(name=>name==="20261028175736_p1_admin_roster_secure_cross_admin_visibility.sql"),
  "Admin roster RLS fix is required for other-admin assignment");
});
test("The admin roster migration enforces administrator isolation",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261028175736_p1_admin_roster_secure_cross_admin_visibility.sql",import.meta.url),"utf8");
 assert.match(sql,/bpei_private\.is_bpei_admin/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/p_user_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/independent_admin_read_roster/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
});

test("Mission foreign keys have covering indexes in the tracked P1 migration",()=>{
 const filename="20261028233020_p1_cover_mission_foreign_keys.sql";
 assert.ok(migrations.includes(filename),"Applied migration must be versioned using the Supabase timestamp");
 const sql=readFileSync(new URL("../supabase/migrations/"+filename,import.meta.url),"utf8");
 for(const [table,column] of [
  ["bpei_incident_events","actor_id"],
  ["bpei_mission_events","actor_id"],
  ["bpei_mission_incidents","reporter_id"],
  ["bpei_mission_incidents","reviewed_by"],
  ["bpei_notifications","incident_id"],
  ["bpei_notifications","mission_id"]
 ]){
  assert.match(sql,new RegExp("on\\s+public\\."+table+"\\s*\\(\\s*"+column+"\\s*\\)","i"),
    table+"."+column+" needs an index for FK lookups");
 }
});
