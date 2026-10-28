import test from "node:test";
import assert from "node:assert/strict";
import {isVerificationCurrent,type ProfessionalCheck} from "../src/lib/bpei-professional-verification.ts";
const at=Date.parse("2026-10-28T12:00:00Z");
const check:ProfessionalCheck={
 user_id:"11111111-1111-4111-8111-111111111111",
 siret:"12345678901234",checked_at:"2026-10-27T12:00:00Z",
 evidence_source:"annuaire_entreprises",evidence_reference:"Contrôle sur registre officiel au 27/10/2026",
 insurance_confirmed:true,insurance_expires_on:"2027-03-01",
 insurance_evidence_reference:"Attestation RC Pro vérifiée le 27 octobre 2026"
};
test("un contrôle récent correspondant au SIRET est exploitable",()=>assert.equal(isVerificationCurrent(check,check.siret,at),true));
test("aucune approbation sans dossier",()=>assert.equal(isVerificationCurrent(undefined,check.siret,at),false));
test("un changement de SIRET invalide le contrôle",()=>assert.equal(isVerificationCurrent(check,"12345678901235",at),false));
test("un SIRET manquant invalide le contrôle",()=>assert.equal(isVerificationCurrent(check,null,at),false));
test("un contrôle vieux de plus de 30 jours est expiré",()=>assert.equal(isVerificationCurrent({...check,checked_at:"2026-09-01T12:00:00Z"},check.siret,at),false));
test("un contrôle futur ne peut pas valider une candidature",()=>assert.equal(isVerificationCurrent({...check,checked_at:"2026-10-29T12:00:00Z"},check.siret,at),false));
test("un contrôle datant d'exactement 30 jours est encore accepté",()=>assert.equal(isVerificationCurrent({...check,checked_at:"2026-09-28T12:00:00Z"},check.siret,at),true));
test("une date corrompue est refusée",()=>assert.equal(isVerificationCurrent({...check,checked_at:"not-a-date"},check.siret,at),false));

test("une attestation RC Pro expirée empêche la validation",()=>assert.equal(isVerificationCurrent({...check,insurance_expires_on:"2026-10-27"},check.siret,at),false));
test("l'assurance doit être confirmée par un administrateur",()=>assert.equal(isVerificationCurrent({...check,insurance_confirmed:false},check.siret,at),false));
test("la preuve d'assurance doit être documentée",()=>assert.equal(isVerificationCurrent({...check,insurance_evidence_reference:"court"},check.siret,at),false));
