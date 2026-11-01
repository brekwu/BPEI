export type IncidentCategory="client_unreachable"|"technical"|"safety"|"other";
export type IncidentStatus="open"|"under_review"|"resolved";
export const incidentCategories:[IncidentCategory,string][]=[
 ["client_unreachable","Client injoignable"],["technical","Difficulté technique"],
 ["safety","Problème de sécurité"],["other","Autre incident"]
];
export function incidentStatusLabel(value:string):string{
 return ({open:"À traiter",under_review:"En cours d'examen",resolved:"Résolu"} as Record<string,string>)[value]??"Statut inconnu";
}
export function incidentCategoryLabel(value:string):string{
 return incidentCategories.find(([name])=>name===value)?.[1]??"Autre incident";
}
export function canReportMissionIncident(value:string):boolean {
 return value==="accepted"||value==="in_progress";
}
export function validIncidentDescription(value:string):boolean{
 return value.trim().length>=30&&value.trim().length<=2000;
}
export function canReviewIncident(from:string,to:string,note:string):boolean{
 const transition=(from==="open"&&(to==="under_review"||to==="resolved"))
   ||(from==="under_review"&&to==="resolved");
 return transition&&(to!=="resolved"||(note.trim().length>=10&&note.trim().length<=2000));
}
