import {useState,type FormEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {canReportMissionIncident,incidentCategories,incidentCategoryLabel,incidentStatusLabel,validIncidentDescription,type IncidentCategory} from "@/lib/bpei-p1-operations";

type Incident={id:string;category:string;description:string;status:string;resolution_note:string|null};
export function MissionIncidentPanel({requestId,status}:{requestId:string;status:string}){
 const [visible,setVisible]=useState(false);
 const [items,setItems]=useState<Incident[]>([]);
 const [category,setCategory]=useState<IncidentCategory>("technical");
 const [description,setDescription]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const allowed=canReportMissionIncident(status);
 async function refresh(){
  const {data,error}=await (supabase as any).from("bpei_mission_incidents")
   .select("id,category,description,status,resolution_note")
   .eq("request_id",requestId).order("created_at",{ascending:false}).limit(20);
  if(error)setNotice("Lecture des incidents impossible.");
  else setItems(data??[]);
 }
 async function send(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!allowed||busy||!validIncidentDescription(description))return;
  setBusy(true);setNotice("");
  const {error}=await (supabase as any).from("bpei_mission_incidents")
   .insert({request_id:requestId,category,description:description.trim()});
  if(error)setNotice("Signalement refusé : vérifiez la mission, les limites de fréquence ou un incident déjà ouvert.");
  else {setDescription("");await refresh();setNotice("Incident enregistré.");}
  setBusy(false);
 }
 if(!allowed&&status!=="completed")return null;
 return <section className="mt-3 space-y-3 rounded-md border p-3" aria-label="Incidents de mission">
  <Button size="sm" type="button" variant="outline" onClick={()=>{setVisible(v=>!v);if(!visible)void refresh();}}>
    {visible?"Masquer les incidents":"Incidents et assistance"}
  </Button>
  {visible&&<div className="space-y-3">
   {notice&&<p role="status" className="text-sm">{notice}</p>}
   {items.map(x=><div key={x.id} className="rounded-md border p-3 text-sm">
    <strong>{incidentCategoryLabel(x.category)} — {incidentStatusLabel(x.status)}</strong>
    <p className="mt-2 whitespace-pre-wrap">{x.description}</p>
    {x.resolution_note&&<p className="mt-2">Réponse BPEI : {x.resolution_note}</p>}
   </div>)}
   {!items.length&&<p className="text-sm">Aucun incident signalé.</p>}
   {allowed&&!items.some(x=>x.status==="open"||x.status==="under_review")&&
   <form onSubmit={e=>void send(e)} className="space-y-3 text-sm">
    <label className="block">Motif
     <select className="mt-1 block w-full rounded-md border bg-background p-2" value={category} onChange={e=>setCategory(e.target.value as IncidentCategory)}>
      {incidentCategories.map(([key,label])=><option key={key} value={key}>{label}</option>)}
     </select>
    </label>
    <label className="block">Description (sans mot de passe ni donnée sensible)
      <Textarea required minLength={30} maxLength={2000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/>
    </label>
    <Button size="sm" type="submit" disabled={busy||!validIncidentDescription(description)}>Signaler l'incident</Button>
   </form>}
  </div>}
 </section>;
}
