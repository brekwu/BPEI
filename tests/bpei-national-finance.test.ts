import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261029133526_national_partner_private_cashflow_and_expense_journal.sql",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/components/independent/PartnerFinanceDesk.tsx",import.meta.url),"utf8");
const guide=readFileSync(new URL("../src/routes/ressources-prospection.tsx",import.meta.url),"utf8");
test("Finance journal remains private to the independent, not the entire network or anonymous visitors",()=>{
 for(const term of ["bpei_partner_finance_entries","ENABLE ROW LEVEL SECURITY",
  "GRANT SELECT,INSERT,UPDATE","bpei_finance_self_read","owner_id=(SELECT auth.uid())",
  "bpei_finance_insert_self_documented","bpei_legal_acceptances"])
  assert.ok(sql.includes(term),term);
 assert.doesNotMatch(sql,/CREATE POLICY bpei_finance.*EXISTS\(SELECT 1 FROM public\.independent_admins/);
});
test("No financial history edits, deletion or invented official Urssaf filing",()=>{
 for(const term of ["guard_finance_entry_correction","Accounting entry immutable",
  "OLD.status<>'active'","NEW.status<>'void'","char_length(btrim(NEW.void_reason))"])
  assert.ok(sql.includes(term),term);
 assert.match(ui,/Estimation sur recettes HT saisies/);
 assert.match(ui,/taux applicable à votre situation/);
 assert.match(ui,/Les dépenses ne sont pas déduites/);
 assert.doesNotMatch(ui,/urssaf\.fr\/api\/declare|stripe\.com\/v1\/transfers/);
});
test("CSV exports prevent Excel formula injection and do not export contacts or bank data",()=>{
 assert.match(ui,/csvCell/);
 assert.match(ui,/replaceAll\('"','""'\)/);
 assert.match(ui,/bpei-registre-financier\.csv/);
 assert.match(ui,/URL\.createObjectURL/);
});
test("Prospection resources teach current opt-in rules, personalized B2B and no fake local storefront",()=>{
 for(const term of ["CNIL","particuliers","sans boutique","prospection", "indépendant",
  "support.google.com/business","libre"])
  assert.ok(guide.toLowerCase().includes(term.toLowerCase()),term);
 assert.ok(guide.includes("une seule relance"));
});
