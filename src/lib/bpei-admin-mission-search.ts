export const ADMIN_MISSION_PAGE_SIZE=25;

export type AdminMissionSummary={
 all_count:number;new_count:number;accepted_count:number;
 in_progress_count:number;completed_count:number;
 cancelled_count:number;attention_count:number;
};

export function missionAttentionLabel(reason:string|null):string|null{
 switch(reason){
  case "incident_open":return "Incident ouvert";
  case "overdue":return "Intervention en retard";
  case "awaiting_reply":return "Proposition sans réponse depuis plus de 24 h";
  default:return null;
 }
}

export function countByMissionStatus(summary:AdminMissionSummary,status:string):number{
 const keys:Record<string,keyof AdminMissionSummary>={
  all:"all_count",new:"new_count",accepted:"accepted_count",
  in_progress:"in_progress_count",completed:"completed_count",cancelled:"cancelled_count"
 };
 const key=keys[status];return key?summary[key]:0;
}

export function missionPageInfo(page:number,total:number,pageSize=ADMIN_MISSION_PAGE_SIZE){
 if(!Number.isInteger(page)||page<0||!Number.isInteger(total)||total<0||
    !Number.isInteger(pageSize)||pageSize<1)throw new Error("Invalid pagination");
 return {
  from:total===0?0:page*pageSize+1,
  to:Math.min(total,(page+1)*pageSize),
  canPrevious:page>0,
  canNext:(page+1)*pageSize<total
 };
}
