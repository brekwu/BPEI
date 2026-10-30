import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL(
  "../supabase/migrations/20261030080119_p0_admin_readiness_strict_reconciliation.sql",
  import.meta.url
), "utf8");

test("P0 dashboard counts only reconciled Stripe TEST payments", () => {
  for (const check of [
    "p.state='paid' AND p.paid_at IS NOT NULL",
    "p.checkout_session_id LIKE 'cs_test_%'",
    "p.currency='eur' AND p.amount_cents=q.gross_cents",
    "m.issuer_id=p.issuer_id AND m.stripe_account_id=p.connected_account_id",
    "i.id=p.invoice_id AND i.issuer_id=p.issuer_id",
    "q.id=i.quote_id AND q.issuer_id=i.issuer_id",
    "m.test_enabled IS TRUE AND m.test_verified_at IS NOT NULL",
    "q.status='accepted' AND q.accepted_at IS NOT NULL",
    "nullif(btrim(q.acceptance_reference),'') IS NOT NULL"
  ]) assert.ok(migration.includes(check), "Missing payment reconciliation: " + check);
});

test("P0 legal readiness requires one published version with all three approved texts", () => {
  for (const check of [
    "c.legal_documents_published IS TRUE",
    "c.legal_version IS NOT NULL",
    "public.bpei_legal_releases r WHERE r.version=c.legal_version",
    "count(DISTINCT d.kind)",
    "d.version=c.legal_version",
    "'mentions-legales','confidentialite','cgu'"
  ]) assert.ok(migration.includes(check), "Missing legal consistency: " + check);
});

test("P0 readiness migration does not enable any public or payment capability", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION bpei_private\.p0_readiness\(\)/);
  assert.match(migration, /SECURITY DEFINER SET search_path=''/);
  assert.match(migration, /BPEI administrator required/);
  assert.doesNotMatch(migration, /\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|GRANT)\s+(?:INTO\s+|FROM\s+|TABLE\s+)?public\./i);
  assert.doesNotMatch(migration, /auth\.admin\.createUser|email_confirm\s*:\s*true/);
});
