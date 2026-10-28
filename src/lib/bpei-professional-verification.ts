export type ProfessionalCheck = {
 user_id:string;
 siret:string;
 checked_at:string;
 evidence_source:string;
 evidence_reference:string;
};
export function isVerificationCurrent(check:ProfessionalCheck|undefined,siret:string|null|undefined,at=Date.now()):boolean {
 if(!check||!siret||check.siret!==siret)return false;
 const checkedAt=new Date(check.checked_at).getTime();
 return Number.isFinite(checkedAt)&&checkedAt<=at&&at-checkedAt<=30*24*60*60*1000;
}
