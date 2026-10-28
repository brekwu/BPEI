export type MissionStatus = "new"|"accepted"|"in_progress"|"completed"|"cancelled";
export type NextMissionStatus = "in_progress"|"completed";

const LABELS: Record<MissionStatus,string>={
  new:"Nouvelle mission",
  accepted:"Acceptée",
  in_progress:"En cours",
  completed:"Terminée",
  cancelled:"Refusée / annulée"
};

export function missionStatusLabel(status:string):string {
  return Object.prototype.hasOwnProperty.call(LABELS,status) ? LABELS[status as MissionStatus] : "Statut inconnu";
}
export function nextMissionStatus(status:string):NextMissionStatus|null {
  if(status==="accepted")return "in_progress";
  if(status==="in_progress")return "completed";
  return null;
}
export function canReadMissionClientContact(status:string):boolean {
  return status==="accepted"||status==="in_progress"||status==="completed";
}
