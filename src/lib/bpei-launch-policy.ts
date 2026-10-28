export type BpeiLaunchState = {
 legal_documents_published: boolean;
 independent_registration_enabled: boolean;
 legal_version: string | null;
};
export function isPublishedLegalVersion(gate:BpeiLaunchState|null|undefined):boolean {
 return gate?.legal_documents_published===true && typeof gate.legal_version==="string" && gate.legal_version.trim().length>=3;
}
export function canRegisterIndependent(gate:BpeiLaunchState|null|undefined):boolean {
 return isPublishedLegalVersion(gate) && gate?.independent_registration_enabled===true;
}
export function canSubmitIndependentApplication(gate:BpeiLaunchState|null|undefined,legalAccepted:boolean):boolean {
 return isPublishedLegalVersion(gate) && legalAccepted===true;
}
