export const incidentPriorities=[
 ["low","Basse"],["normal","Normale"],["high","Haute"],["critical","Critique"]
] as const;
export type IncidentPriority=(typeof incidentPriorities)[number][0];
export type IncidentQueueFilter="active"|"unassigned"|"overdue"|"mine"|"resolved"|"all";

export function incidentPriorityLabel(value:string):string {
 return incidentPriorities.find(([id])=>id===value)?.[1]??"Non reconnue";
}
export function incidentPriorityIsValid(value:string):value is IncidentPriority {
 return incidentPriorities.some(([id])=>id===value);
}
export function escalationReasonIsValid(value:string):boolean {
 const length=value.trim().length;
 return length>=10&&length<=500;
}
export function incidentQueueTitle(filter:IncidentQueueFilter):string {
 return ({active:"À traiter",unassigned:"Non attribués",overdue:"Échéance dépassée",
 mine:"Mes incidents",resolved:"Résolus",all:"Tous les incidents"} as Record<string,string>)[filter];
}
export function incidentIsOverdue(targetAt:string,status:string,now=Date.now()):boolean{
 return status!=="resolved"&&Number.isFinite(new Date(targetAt).getTime())
  &&new Date(targetAt).getTime()<now;
}
