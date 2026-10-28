import {missionStatusLabel} from "./bpei-mission-status.ts";

export type MissionEvent = {
 id:string;
 request_id:string;
 previous_status:string|null;
 new_status:string;
 occurred_at:string;
};

export function missionEventDescription(event:Pick<MissionEvent,"previous_status"|"new_status">):string {
 if(event.previous_status===null)return "Mission créée — "+missionStatusLabel(event.new_status);
 return missionStatusLabel(event.previous_status)+" → "+missionStatusLabel(event.new_status);
}

export const missionStatusFilters = [
 ["all","Toutes"],["new","Proposées"],["accepted","Acceptées"],
 ["in_progress","En cours"],["completed","Terminées"],["cancelled","Annulées"]
] as const;

export function filterMissionStatus(status:string,selection:string):boolean {
 return selection==="all" || status===selection;
}
