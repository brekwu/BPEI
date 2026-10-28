import test from "node:test";
import assert from "node:assert/strict";
import {readdirSync,readFileSync} from "node:fs";

const migrations=readdirSync(new URL("../supabase/migrations/",import.meta.url))
 .filter(name=>name.endsWith(".sql")).sort();
const readme=readFileSync(new URL("../supabase/README.md",import.meta.url),"utf8");

test("Every applied Supabase migration is present exactly once in the repository",()=>{
 assert.equal(migrations.length,37,"Migration 37 and earlier must be committed to GitHub");
 assert.equal(new Set(migrations.map(name=>name.slice(0,14))).size,37,
  "Supabase migration timestamps must be unique");
 assert.ok(migrations.every((name,index)=>index===0||name>migrations[index-1]),
  "Migration files must have monotonic names");
 assert.match(readme,/37 migrations appliquées/);
 assert.match(readme,/37 fichiers SQL versionnés/);
 assert.ok(migrations.some(name=>name==="20261028175736_p1_admin_roster_secure_cross_admin_visibility.sql"),
  "Admin roster RLS fix is required for other-admin assignment");
});
test("The last migration enforces admin isolation in the roster",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261028175736_p1_admin_roster_secure_cross_admin_visibility.sql",import.meta.url),"utf8");
 assert.match(sql,/bpei_private\.is_bpei_admin/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/p_user_id=\(SELECT auth\.uid\(\)\)/);
 assert.match(sql,/independent_admin_read_roster/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
});
