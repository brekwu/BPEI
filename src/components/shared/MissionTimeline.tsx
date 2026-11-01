import {useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {missionEventDescription,type MissionEvent} from "@/lib/bpei-mission-events";

export function MissionTimeline({missionId}:{missionId:string}){
 const [expanded,setExpanded]=useState(false);
 const [events,setEvents]=useState<MissionEvent[]>([]);
 const [loading,setLoading]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState("");
 async function load(){
  setLoading(true);setError("");
  const {data,error:e}=await (supabase as any).from("bpei_mission_events")
   .select("id,request_id,previous_status,new_status,occurred_at")
   .eq("request_id",missionId).order("occurred_at",{ascending:true}).limit(100);
  if(e){setError("Historique indisponible. Réessayez.");setLoaded(false);}
  else {setEvents(data??[]);setLoaded(true);}
  setLoading(false);
 }
 return <section aria-label="Historique de mission" className="mt-3 space-y-2">
   <div className="flex flex-wrap gap-2">
     <Button type="button" size="sm" variant="outline" onClick={()=>{
       setExpanded(x=>!x);
       if(!expanded&&!loaded)void load();
     }}>{expanded?"Masquer l'historique":"Voir l'historique"}</Button>
     {expanded&&<Button type="button" size="sm" variant="outline" disabled={loading} onClick={()=>void load()}>Actualiser</Button>}
   </div>
   {expanded&&<div className="rounded-md border p-3">
     {loading&&<p role="status" className="text-sm">Chargement de l'historique…</p>}
     {error&&<p role="alert" className="text-sm">{error}</p>}
     {loaded&&events.length===0&&<p className="text-sm text-muted-foreground">Aucun historique disponible.</p>}
     {loaded&&events.length>0&&<ol className="space-y-3 border-l pl-4">
       {events.map(e=><li key={e.id} className="text-sm">
         <p className="font-medium">{missionEventDescription(e)}</p>
         <time className="text-xs text-muted-foreground" dateTime={e.occurred_at}>
           {new Date(e.occurred_at).toLocaleString("fr-FR")}
         </time>
       </li>)}
     </ol>}
   </div>}
 </section>;
}
