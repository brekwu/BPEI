export type ProfessionalCheck = {
 user_id:string;
 siret:string;
 checked_at:string;
 evidence_source:string;
 evidence_reference:string;
 insurance_confirmed:boolean;
 insurance_expires_on:string|null;
 insurance_evidence_reference:string|null;
};
export function isVerificationCurrent(check:ProfessionalCheck|undefined,siret:string|null|undefined,at=Date.now()):boolean {
 if(!check||!siret||check.siret!==siret)return false;
 if(check.insurance_confirmed!==true || !check.insurance_expires_on || !check.insurance_evidence_reference || check.insurance_evidence_reference.trim().length<20)return false;
 if(check.insurance_expires_on < new Date(at).toISOString().slice(0,10))return false;
 const checkedAt=new Date(check.checked_at).getTime();
 return Number.isFinite(checkedAt)&&checkedAt<=at&&at-checkedAt<=30*24*60*60*1000;
}
