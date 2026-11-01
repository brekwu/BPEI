import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const runbook=readFileSync(
 new URL("../docs/p0/MISE_EN_SERVICE.md",import.meta.url),"utf8"
);

test("BPEI DNS runbook treats dashboard values as dated evidence, not permanent instructions",()=>{
 for(const required of [
  "misconfigured=true","185.158.133.1","photographie datée",
  "get_domain_config","Vercel → Project → Settings → Domains",
  "Ne pas modifier MX, SPF, DKIM, DMARC",
  "ne signifie pas que le trafic DNS arrive sur Vercel"
 ]) assert.ok(runbook.includes(required),required);
 assert.doesNotMatch(runbook,/recommande actuellement deux enregistrements `A` vers/,
  "Avoid prescribing stale A records for the apex.");
 assert.match(runbook,/Vercel Authentication reste activée/);
 assert.match(runbook,/NE PAS exécuter avant validation du lancement/);
});
