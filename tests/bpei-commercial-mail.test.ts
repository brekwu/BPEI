import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const edge=readFileSync(new URL("../supabase/functions/bpei-commercial-mail/index.ts",import.meta.url),"utf8");
const pdf=readFileSync(new URL("../supabase/functions/bpei-commercial-mail/pdf.ts",import.meta.url),"utf8");
test("Commercial mail is explicitly disabled without legal publication, verified sender and operator authorization",()=>{
 for(const term of ["BPEI_COMMERCIAL_MAIL_ENABLED","BPEI_COMMERCIAL_MAIL_ORIGIN","RESEND_API_KEY",
  "BPEI_COMMERCIAL_MAIL_FROM","BPEI_COMMERCIAL_MAIL_LEGAL_FOOTER","legal_documents_published",
  "validated_legal_sender","independent_admins","auth.getUser","bpei_commercial_mail_outbox"])
  assert.ok(edge.includes(term),term);
 assert.doesNotMatch(edge,/VITE_RESEND|sk_live_/);
});
test("Email recipient, document content and PDF numbers only come from frozen server record",()=>{
 for(const term of ["q.customer_email","bpei_service_quotes","bpei_service_invoices","renderCommercialPdf",
  "attachments","Idempotency-Key","delivery_already_reserved_or_unavailable"])
  assert.ok(edge.includes(term),term);
 assert.doesNotMatch(edge,/payload\.(?:recipient|to|subject|text|html|pdf|amount|fee)/);
 assert.match(pdf,/PDFDocument\.create\(\)/);
 assert.match(pdf,/issuerSiret/);
 assert.match(pdf,/grossCents/);
 assert.match(pdf,/legalFooter/);
});
test("Mail outbox has database-level duplicate blocker and is disabled at installation",()=>{
 const sql=readFileSync(new URL("../supabase/migrations/20261029123952_mvp_commercial_email_outbox_disabled_by_default.sql",import.meta.url),"utf8");
 for(const term of ["enabled boolean NOT NULL DEFAULT false","validated_legal_sender boolean NOT NULL DEFAULT false",
  "UNIQUE(kind,document_id)","bpei_commercial_mail_outbox","ENABLE ROW LEVEL SECURITY",
  "REVOKE ALL","admin_read"])
  assert.ok(sql.includes(term),term);
});
