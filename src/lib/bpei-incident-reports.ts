export type IncidentStatistics={
 period_days:number;
 calculated_at:string;
 total:number;open:number;under_review:number;resolved:number;
 unassigned:number;overdue:number;critical_active:number;
 low:number;normal:number;high:number;critical:number;
 average_resolution_hours:number|null;
};

export type IncidentExportRow={
 id:string;request_id:string;category:string;status:string;priority:string;
 created_at:string;reviewed_at:string|null;target_at:string|null;
 assigned_admin_id:string|null;resolution_note:string|null;
};

export type IncidentReport={
 id:string;request_id:string;category:string;status:string;priority:string;
 created_at:string;reviewed_at:string|null;target_at:string|null;
 description:string;resolution_note:string|null;
};
export type IncidentReportEvent={
 event_kind:string;created_at:string;previous_status:string|null;new_status:string|null;
 previous_priority:string|null;new_priority:string|null;reason:string|null;
};

export const PERIOD_OPTIONS=[7,30,90] as const;
export const EXPORT_MAX_ROWS=1000;

export function validStatisticsPeriod(days:number):boolean{
 return PERIOD_OPTIONS.includes(days as (typeof PERIOD_OPTIONS)[number]);
}
export function formatDurationHours(hours:number|null):string{
 return hours===null?"Aucune résolution":hours.toLocaleString("fr-FR",{maximumFractionDigits:1})+" h";
}
/** Protect spreadsheet applications from Excel/Sheets formula injection. */
export function escapeCsvCell(value:unknown):string{
 const raw=value==null?"":String(value);
 const safe=/^\s*[=+\-@\t\r]/u.test(raw)?"'"+raw:raw;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function exportIncidentCsv(rows:IncidentExportRow[]):string{
 const headers=["Incident","Mission","Type","Statut","Priorité","Créé le (UTC)","Résolu le (UTC)",
  "Échéance (UTC)","Administrateur ID","Compte rendu"];
 const keys:(keyof IncidentExportRow)[]=["id","request_id","category","status","priority",
  "created_at","reviewed_at","target_at","assigned_admin_id","resolution_note"];
 return "\uFEFF"+headers.map(escapeCsvCell).join(";")+"\r\n"+
   rows.map(row=>keys.map(key=>escapeCsvCell(row[key])).join(";")).join("\r\n")+
   (rows.length?"\r\n":"");
}
function timestamp(value:string|null):string{
 if(!value)return "Non renseigné";
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"Date inconnue":date.toISOString();
}
export function buildIncidentResolutionReport(incident:IncidentReport,events:IncidentReportEvent[]):string{
 const steps=events.map(event=>
  "- "+timestamp(event.created_at)+" | "+event.event_kind+
  (event.new_status?" | statut "+event.new_status:"")+
  (event.new_priority?" | priorité "+event.new_priority:"")+
  (event.reason?" | Motif : "+event.reason:"")
 ).join("\n");
 return [
 "BPEI — RAPPORT INTERNE DE RÉSOLUTION",
 "Document confidentiel : vérifier les destinataires avant tout partage.",
 "Incident : "+incident.id,
 "Mission : "+incident.request_id,
 "Type : "+incident.category,
 "Statut : "+incident.status,
 "Priorité : "+incident.priority,
 "Créé le : "+timestamp(incident.created_at),
 "Résolu le : "+timestamp(incident.reviewed_at),
 "Échéance indicative : "+timestamp(incident.target_at),
 "",
 "DESCRIPTION DE L'INCIDENT",
 incident.description,
 "",
 "COMPTE RENDU DE RÉSOLUTION",
 incident.resolution_note??"Aucune note disponible",
 "",
 "HISTORIQUE DES DÉCISIONS",
 steps||"Aucun événement disponible",
 ""
 ].join("\n");
}
