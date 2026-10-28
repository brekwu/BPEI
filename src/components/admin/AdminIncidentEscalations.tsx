import {useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {IncidentResolutionReportButton} from "@/components/admin/IncidentResolutionReportButton";
import {canReviewIncident,incidentCategoryLabel,incidentStatusLabel} from "@/lib/bpei-p1-operations";
import {
 incidentPriorities,incidentPriorityLabel,incidentPriorityIsValid,
 escalationReasonIsValid,incidentIsOverdue,
 incidentQueueTitle,type IncidentPriority,type IncidentQueueFilter
} from "@/lib/bpei-incident-escalation";

type Incident={
 id:string;request_id:string;category:string;description:string;
 status:string;resolution_note:string|null;reviewed_at:string|null;priority:string;
 assigned_admin_id:string|null;target_at:string;created_at:string;
 escalation_reason:string|null
};
type Admin={user_id:string};
type IncidentEvent={
 id:string;event_kind:string;previous_priority:string|null;new_priority:string|null;
 previous_status:string|null;new_status:string|null;
 new_assignee:string|null;reason:string|null;created_at:string
};
const PAGE_SIZE=25;

function IncidentHistory({incidentId}:{incidentId:string}){
 const [open,setOpen]=useState(false);
 const [items,setItems]=useState<IncidentEvent[]>([]);
 const [error,setError]=useState("");
 async function load(){
  const {data,error:e}=await (supabase as any).from("bpei_incident_events")
   .select("id,event_kind,previous_priority,new_priority,previous_status,new_status,new_assignee,reason,created_at")
   .eq("incident_id",incidentId).order("created_at",{ascending:false}).limit(50);
  if(e)setError("Historique indisponible.");
  else {setItems(data??[]);setError("");}
 }
 function describe(x:IncidentEvent):string{
  switch(x.event_kind){
   case "created":return "Incident créé";
   case "priority":return "Priorité : "+incidentPriorityLabel(x.previous_priority??"")+" → "+incidentPriorityLabel(x.new_priority??"");
   case "assigned":return "Responsable affecté";
   case "unassigned":return "Responsable retiré";
   case "status":return "Statut : "+incidentStatusLabel(x.previous_status??"")+" → "+incidentStatusLabel(x.new_status??"");
   default:return "Modification";
  }
 }
 return <section className="mt-3 space-y-2">
   <Button type="button" size="sm" variant="outline" onClick={()=>{
    setOpen(x=>!x);if(!open)void load();
   }}>{open?"Masquer l'historique":"Historique des décisions"}</Button>
   {open&&<div className="rounded-md border p-3 text-sm">
    {error&&<p role="alert">{error}</p>}
    {!items.length&&!error&&<p>Aucun historique.</p>}
    <ol className="space-y-3">
     {items.map(x=><li key={x.id}>
      <p className="font-medium">{describe(x)}</p>
      {x.reason&&<p className="whitespace-pre-wrap text-muted-foreground">{x.reason}</p>}
      <time dateTime={x.created_at} className="text-xs text-muted-foreground">{new Date(x.created_at).toLocaleString("fr-FR")}</time>
     </li>)}
    </ol>
   </div>}
 </section>;
}
export function AdminIncidentEscalations(){
 const [items,setItems]=useState<Incident[]>([]);
 const [admins,setAdmins]=useState<Admin[]>([]);
 const [myId,setMyId]=useState<string|null>(null);
 const [filter,setFilter]=useState<IncidentQueueFilter>("active");
 const [page,setPage]=useState(0);
 const [total,setTotal]=useState(0);
 const [revision,setRevision]=useState(0);
 const [busy,setBusy]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [selectedPriority,setSelectedPriority]=useState<Record<string,IncidentPriority>>({});
 const [assignees,setAssignees]=useState<Record<string,string>>({});
 const [reasons,setReasons]=useState<Record<string,string>>({});
 const [resolutionNotes,setResolutionNotes]=useState<Record<string,string>>({});
 const filters:[IncidentQueueFilter,string][]=[
  ["active","À traiter"],["unassigned","Non attribués"],
  ["overdue","En retard"],["mine","Mes incidents"],["resolved","Résolus"],["all","Tous"]
 ];
 useEffect(()=>{
  let alive=true;
  (async()=>{
   const user=await supabase.auth.getUser();
   const id=user.data.user?.id??null;
   if(!alive)return;
   setMyId(id);
   if(!id)return;
   const {data,error:e}=await (supabase as any).from("independent_admins")
     .select("user_id").order("created_at",{ascending:true}).limit(100);
   if(!alive)return;
   if(e)setError("Liste des administrateurs indisponible.");
   else setAdmins(data??[]);
  })().catch(()=>{if(alive)setError("Lecture des administrateurs indisponible.")});
  return ()=>{alive=false;};
 },[]);
 useEffect(()=>{
  let alive=true;
  setLoading(true);
  (async()=>{
   let query=(supabase as any).from("bpei_mission_incidents")
    .select("id,request_id,category,description,status,resolution_note,reviewed_at,priority,assigned_admin_id,target_at,created_at,escalation_reason",{count:"exact"});
   if(filter==="active")query=query.in("status",["open","under_review"]);
   if(filter==="unassigned")query=query.in("status",["open","under_review"]).is("assigned_admin_id",null);
   if(filter==="overdue")query=query.in("status",["open","under_review"]).lt("target_at",new Date().toISOString());
   if(filter==="mine")query=query.eq("assigned_admin_id",myId??"00000000-0000-4000-8000-000000000000").in("status",["open","under_review"]);
   if(filter==="resolved")query=query.eq("status","resolved");
   const {data,count,error:e}=await query
    .order("target_at",{ascending:true}).order("created_at",{ascending:true})
    .range(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE-1);
   if(!alive)return;
   if(e){setError("Impossible de charger les incidents. Vérifiez les droits administrateur.");setItems([]);}
   else {setItems(data??[]);setTotal(count??0);setError("");}
   setLoading(false);
  })().catch(()=>{if(alive){setError("Liste des incidents indisponible.");setLoading(false);}});
  return ()=>{alive=false;};
 },[filter,page,revision,myId]);
 function selectFilter(next:IncidentQueueFilter){setFilter(next);setPage(0);}
 async function mutate(id:string,action:"priority"|"assign"|"unassign",priority:string|null=null,assigned:string|null=null,reason:string|null=null){
  if(busy)return;
  setBusy(id);setError("");
  const {error:e}=await (supabase as any).rpc("manage_incident_escalation",{
   p_incident_id:id,p_action:action,p_priority:priority,
   p_assigned_admin_id:assigned,p_reason:reason?.trim()||null
  });
  if(e)setError("Modification refusée : vérifiez les droits, l'état de l'incident et la justification.");
  else {setReasons(p=>({...p,[id]:""}));setRevision(n=>n+1);}
  setBusy(null);
 }
 async function review(x:Incident,next:"under_review"|"resolved"){
  if(busy)return;
  const note=resolutionNotes[x.id]??"";
  if(!canReviewIncident(x.status,next,note))return;
  if(next==="resolved"&&!window.confirm("Confirmer la résolution et notifier le technicien ?"))return;
  setBusy(x.id);setError("");
  const {error:e}=await (supabase as any).rpc("review_bpei_incident",{
   p_incident_id:x.id,p_next_status:next,p_resolution:next==="resolved"?note.trim():null
  });
  if(e)setError("Transition de statut refusée.");
  else {setResolutionNotes(p=>({...p,[x.id]:""}));setRevision(n=>n+1);}
  setBusy(null);
 }
 const canNext=(page+1)*PAGE_SIZE<total;
 return <section className="mt-10 space-y-5" aria-label="Escalades administratives">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-xl font-semibold">Escalades et responsables des incidents</h2>
     <p className="mt-1 text-sm text-muted-foreground">Priorité, responsable et objectif interne de traitement. Les échéances ne constituent pas une garantie contractuelle.</p>
   </div>
   <Button type="button" variant="outline" disabled={loading||!!busy} onClick={()=>setRevision(x=>x+1)}>Actualiser</Button>
  </div>
  <div className="flex flex-wrap gap-2">
   {filters.map(([id,label])=><Button key={id} type="button" size="sm" variant={filter===id?"default":"outline"}
    onClick={()=>selectFilter(id)}>{label}</Button>)}
  </div>
  <p className="text-sm text-muted-foreground">{incidentQueueTitle(filter)} : {total} incident(s)</p>
  {loading&&<p role="status">Chargement des incidents…</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {!loading&&!error&&items.length===0&&<p className="rounded-lg border p-4 text-sm">Aucun incident pour ce filtre.</p>}
  <div className="space-y-4">
   {items.map(x=>{
    const isActive=x.status!=="resolved";
    const picked=selectedPriority[x.id]??(incidentPriorityIsValid(x.priority)?x.priority:"normal");
    const assigned=assignees[x.id]??x.assigned_admin_id??"";
    const reason=reasons[x.id]??"";
    const overdue=incidentIsOverdue(x.target_at,x.status);
    return <article key={x.id} className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
       <h3 className="font-semibold">{incidentCategoryLabel(x.category)} · {incidentStatusLabel(x.status)}</h3>
       <span className="text-sm font-medium">Priorité : {incidentPriorityLabel(x.priority)}</span>
      </div>
      <p className="text-xs text-muted-foreground">Mission {x.request_id} · Créé le {new Date(x.created_at).toLocaleString("fr-FR")}</p>
      <p className="text-sm whitespace-pre-wrap">{x.description}</p>
      <p className={"text-sm "+(overdue?"font-semibold text-destructive":"text-muted-foreground")}>
       {overdue?"Échéance indicative dépassée : ":"Objectif de traitement : "}
       {new Date(x.target_at).toLocaleString("fr-FR")}
      </p>
      <p className="text-sm">Responsable : {x.assigned_admin_id?
        (x.assigned_admin_id===myId?"Vous":"Administrateur "+x.assigned_admin_id.slice(0,8)):"Non attribué"}</p>
      {isActive&&<div className="space-y-3 rounded-lg border p-3">
       <label className="block text-sm">Priorité
        <select className="mt-1 block w-full rounded-md border bg-background p-2" value={picked}
         onChange={e=>setSelectedPriority(p=>({...p,[x.id]:e.target.value as IncidentPriority}))}>
          {incidentPriorities.map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
       </label>
       <label className="block text-sm">Justification de l'escalade (10 à 500 caractères)
        <Textarea rows={2} maxLength={500} value={reason} onChange={e=>setReasons(p=>({...p,[x.id]:e.target.value}))}/>
       </label>
       <Button type="button" size="sm" disabled={!!busy||picked===x.priority||!escalationReasonIsValid(reason)}
        onClick={()=>void mutate(x.id,"priority",picked,null,reason)}>Enregistrer la priorité</Button>
       <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-44 flex-1 text-sm">Administrateur responsable
         <select className="mt-1 block w-full rounded-md border bg-background p-2" value={assigned}
          onChange={e=>setAssignees(p=>({...p,[x.id]:e.target.value}))}>
          <option value="">Choisir un administrateur</option>
          {admins.map(a=><option key={a.user_id} value={a.user_id}>
            {a.user_id===myId?"Moi":"Administrateur "+a.user_id.slice(0,8)}
          </option>)}
         </select>
        </label>
        <Button type="button" size="sm" disabled={!!busy||!assigned||assigned===x.assigned_admin_id}
         onClick={()=>void mutate(x.id,"assign",null,assigned,reason)}>Affecter</Button>
        {x.assigned_admin_id&&<Button type="button" size="sm" variant="outline" disabled={!!busy}
         onClick={()=>void mutate(x.id,"unassign")}>Retirer l'affectation</Button>}
       </div>
       <label className="block text-sm">Note de résolution (10 caractères minimum)
        <Textarea rows={3} maxLength={2000} value={resolutionNotes[x.id]??""}
         onChange={e=>setResolutionNotes(p=>({...p,[x.id]:e.target.value}))}/>
       </label>
       <div className="flex flex-wrap gap-2">
        {x.status==="open"&&<Button type="button" size="sm" variant="outline" disabled={!!busy}
         onClick={()=>void review(x,"under_review")}>Prendre en charge</Button>}
        <Button type="button" size="sm" disabled={!!busy||!canReviewIncident(x.status,"resolved",resolutionNotes[x.id]??"")}
         onClick={()=>void review(x,"resolved")}>Résoudre l'incident</Button>
       </div>
      </div>}
      {x.status==="resolved"&&x.resolution_note&&<p className="rounded-md border p-3 text-sm">Résolution : {x.resolution_note}</p>}
      <IncidentResolutionReportButton incident={x}/>
      <IncidentHistory incidentId={x.id}/>
     </article>;
   })}
  </div>
  {!error&&total>0&&<div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
   <p className="text-sm">Page {page+1} · {Math.min(total,page*PAGE_SIZE+1)}–{Math.min(total,(page+1)*PAGE_SIZE)} sur {total}</p>
   <div className="flex gap-2">
    <Button type="button" variant="outline" disabled={loading||page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Précédent</Button>
    <Button type="button" variant="outline" disabled={loading||!canNext} onClick={()=>setPage(p=>p+1)}>Suivant</Button>
   </div>
  </div>}
 </section>;
}
