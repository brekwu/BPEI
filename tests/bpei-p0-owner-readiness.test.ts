import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../scripts/p0-owner-readiness.sql", import.meta.url), "utf8");

test("P0 operator diagnostics remain read-only and do not open production", () => {
  assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE)\s+(?:INTO\s+|FROM\s+|TABLE\s+|ROLE\s+)?(?:public\.|auth\.)/i);
  assert.doesNotMatch(sql, /\b(?:set_config|setval|dblink|http_post|auth\.admin|service_role)\s*\(/i);
  assert.match(sql, /WITH facts AS \(/);
  assert.match(sql, /SELECT ordinal,checkpoint/);
});

test("P0 owner report covers every real-world release dependency without fabricating evidence", () => {
  for (const term of [
    "Administrateur confirmé",
    "SMTP / confirmation e-mail",
    "Juridique",
    "Envoi devis / factures",
    "Commissions / facturation électronique",
    "Stripe TEST",
    "Pilote de bout en bout",
    "auth.users",
    "email_confirmed_at",
    "bpei_p0_attestations",
    "bpei_legal_releases",
    "bpei_service_invoices",
    "bpei_payment_attempts",
  ]) assert.ok(sql.includes(term), "Missing P0 requirement: " + term);
  assert.match(sql, /conditions SQL presentes/i.test(sql) ? /CONDITIONS SQL PRESENTES/ : /CONDITIONS SQL PRESENTES/);
  assert.match(sql, /NON PRET/);
});
