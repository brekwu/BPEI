import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {canReviewIncident,incidentCategoryLabel,incidentStatusLabel} from "@/lib/bpei-p1-operations";
type Incident={id:string;request_id:string;category:string;description:string;status:string;resolution_note:string|null};
export function AdminMissionIncidents(){
 const [items,setItems]=useState<Incident[]>([]);
 const [notes,setNotes]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function refresh(){
  const {data,error:e}=await (supabase as any).from("bpei_mission_incidents")
   .select("id,request_id,category,description,status,resolution_note")
   .order("created_at",{ascending:false}).limit(100);
  if(e)setError("Impossible de lire les incidents. Vérifiez votre autorisation.");
  else {setItems(data??[]);setError("");}
 }
 useEffect(()=>{void refresh()},[]);
 async function review(x:Incident,next:"under_review"|"resolved"){
  const note=notes[x.id]??"";
  if(busy||!canReviewIncident(x.status,next,note))return;
  if(next==="resolved"&&!window.confirm("Confirmer la résolution de cet incident ?"))return;
  setBusy(true);setError("");
  const {error:e}=await (supabase as any).rpc("review_bpei_incident",{
   p_incident_id:x.id,p_next_status:next,p_resolution:next==="resolved"?note.trim():null
  });
  if(e)setError("Modification refusée : vérifiez les autorisations et l'état du dossier.");
  else await refresh();
  setBusy(false);
 }
 return <section className="mt-12 space-y-4" aria-label="Incidents des missions">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h2 className="text-xl font-semibold">Incidents de missions</h2>
   <Button type="button" variant="outline" onClick={()=>void refresh()}>Actualiser</Button>
  </div>
  {error&&<p role="alert">{error}</p>}
  {!items.length&&<p className="text-sm text-muted-foreground">Aucun incident ouvert.</p>}
  {items.map(x=><article key={x.id} className="space-y-3 rounded-xl border bg-card p-5">
   <h3 className="font-semibold">{incidentCategoryLabel(x.category)} — {incidentStatusLabel(x.status)}</h3>
   <p className="text-xs text-muted-foreground">Mission : {x.request_id}</p>
   <p className="whitespace-pre-wrap text-sm">{x.description}</p>
   {x.status==="resolved"?<p className="text-sm">Résolution : {x.resolution_note}</p>:<>
    <label className="block text-sm">Compte rendu de résolution
     <Textarea rows={3} maxLength={2000} value={notes[x.id]??""} onChange={e=>setNotes(p=>({...p,[x.id]:e.target.value}))}/>
    </label>
    <div className="flex flex-wrap gap-2">
     {x.status==="open"&&<Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void review(x,"under_review")}>Prendre en charge</Button>}
     <Button type="button" size="sm" disabled={busy||!canReviewIncident(x.status,"resolved",notes[x.id]??"")} onClick={()=>void review(x,"resolved")}>Résoudre</Button>
    </div>
   </>}
  </article>)}
 </section>;
}
