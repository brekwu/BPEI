import {useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {
 buildIncidentResolutionReport,
 type IncidentReport,type IncidentReportEvent
} from "@/lib/bpei-incident-reports";

export function IncidentResolutionReportButton({incident}:{incident:IncidentReport}){
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function downloadReport(){
  if(busy||incident.status!=="resolved")return;
  setBusy(true);setError("");
  try{
   const db=supabase as any;
   const {data:user,error:userError}=await supabase.auth.getUser();
   if(userError||!user.user)throw new Error("No session");
   const {data:admin,error:adminError}=await db.from("independent_admins")
     .select("user_id").eq("user_id",user.user.id).maybeSingle();
   if(adminError||!admin)throw new Error("Not administrator");
   const {data:events,error:e}=await db.from("bpei_incident_events")
     .select("event_kind,created_at,previous_status,new_status,previous_priority,new_priority,reason")
     .eq("incident_id",incident.id).order("created_at",{ascending:true}).limit(500);
   if(e||!events)throw new Error("Cannot load event history");
   if(events.length>=500)throw new Error("Report history exceeded limit");
   const text=buildIncidentResolutionReport(incident,events as IncidentReportEvent[]);
   const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement("a");
   anchor.href=url;
   anchor.download="bpei-rapport-resolution-"+incident.id+".txt";
   document.body.appendChild(anchor);anchor.click();anchor.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch{
   setError("Rapport indisponible. Vérifiez votre session administrateur et l'historique du dossier.");
  }finally{
   setBusy(false);
  }
 }
 if(incident.status!=="resolved")return null;
 return <div className="space-y-2">
  <Button size="sm" type="button" variant="outline" disabled={busy} onClick={()=>void downloadReport()}>
   {busy?"Génération…":"Télécharger le rapport de résolution"}
  </Button>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  <p className="text-xs text-muted-foreground">Rapport interne contenant la description, la résolution et l'historique. Vérifiez son contenu avant partage.</p>
 </div>;
}
