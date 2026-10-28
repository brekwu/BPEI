import {useEffect,useState,type FormEvent} from "react";
import {Link} from "@tanstack/react-router";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {MissionTimeline} from "@/components/shared/MissionTimeline";
import {missionStatusLabel} from "@/lib/bpei-mission-status";
import {missionStatusFilters} from "@/lib/bpei-mission-events";
import {
 ADMIN_MISSION_PAGE_SIZE,countByMissionStatus,missionAttentionLabel,missionPageInfo,
 type AdminMissionSummary
} from "@/lib/bpei-admin-mission-search";

type Mission={
 id:string;title:string;status:string;created_at:string;scheduled_at:string|null;
 independent_id:string;technician_name:string|null;technician_city:string|null;
 active_incidents:number;attention_reason:string|null
};
type SearchResult={items:Mission[];total:number;summary:AdminMissionSummary};
type SearchFilters={query:string;status:string;attention:string;page:number};
const initialSummary:AdminMissionSummary={
 all_count:0,new_count:0,accepted_count:0,in_progress_count:0,completed_count:0,cancelled_count:0,attention_count:0
};
const emptyResult:SearchResult={items:[],total:0,summary:initialSummary};

export function AdminMissionBoardServer(){
 const [draft,setDraft]=useState("");
 const [filters,setFilters]=useState<SearchFilters>({query:"",status:"all",attention:"all",page:0});
 const [revision,setRevision]=useState(0);
 const [result,setResult]=useState<SearchResult>(emptyResult);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");

 useEffect(()=>{
  let active=true;
  setLoading(true);setError("");
  (async()=>{
   const {data,error:requestError}=await (supabase as any).rpc("bpei_admin_search_missions",{
    p_query:filters.query,p_status:filters.status,p_attention:filters.attention,
    p_limit:ADMIN_MISSION_PAGE_SIZE,p_offset:filters.page*ADMIN_MISSION_PAGE_SIZE
   });
   if(!active)return;
   if(requestError||!data||!Array.isArray(data.items)||typeof data.total!=="number"){
    setError("Recherche des missions indisponible. Vérifiez vos droits d'administration et réessayez.");
    setResult(emptyResult);
   }else{
    const response=data as SearchResult;
    setResult(response);
    if(filters.page>0&&filters.page*ADMIN_MISSION_PAGE_SIZE>=response.total){
      setFilters(f=>({...f,page:Math.max(0,Math.ceil(response.total/ADMIN_MISSION_PAGE_SIZE)-1)}));
    }
   }
   setLoading(false);
  })().catch(()=>{
   if(active){setError("Connexion aux missions indisponible.");setLoading(false);}
  });
  return ()=>{active=false};
 },[filters.query,filters.status,filters.attention,filters.page,revision]);

 const page=missionPageInfo(filters.page,result.total);
 function search(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  setFilters(f=>({...f,query:draft.trim(),page:0}));
  if(draft.trim()===filters.query)setRevision(x=>x+1);
 }
 return <section className="space-y-5" aria-label="Suivi des missions">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-xl font-semibold">Suivi des missions</h2>
    <p className="mt-1 text-sm text-muted-foreground">Recherche et pagination directement en base, réservées aux administrateurs BPEI.</p>
   </div>
   <Button type="button" variant="outline" size="sm" disabled={loading} onClick={()=>setRevision(n=>n+1)}>Actualiser</Button>
  </div>
  <div className="grid gap-3 sm:grid-cols-3">
   <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Missions trouvées</p>
    <p className="mt-1 text-2xl font-semibold">{result.summary.all_count}</p></div>
   <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Nécessitent une attention</p>
    <p className="mt-1 text-2xl font-semibold">{result.summary.attention_count}</p></div>
   <div className="rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">Résultats pour ce filtre</p>
    <p className="mt-1 text-2xl font-semibold">{result.total}</p></div>
  </div>
  <form onSubmit={search} className="flex flex-wrap items-end gap-2">
    <label className="min-w-56 flex-1 text-sm">Titre de mission ou nom du technicien
      <input className="mt-1 block w-full rounded-md border bg-background p-2" maxLength={120}
       value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Saisir un mot-clé"/>
    </label>
    <Button type="submit" disabled={loading}>Rechercher</Button>
    {filters.query!==""&&<Button type="button" variant="outline" onClick={()=>{
      setDraft("");setFilters(f=>({...f,query:"",page:0}));
    }}>Effacer</Button>}
  </form>
  <div className="flex flex-wrap gap-2">
   {missionStatusFilters.map(([value,label])=><Button type="button" size="sm" key={value}
     variant={filters.status===value?"default":"outline"}
     onClick={()=>setFilters(f=>({...f,status:value,page:0}))}>
     {label} ({countByMissionStatus(result.summary,value)})
   </Button>)}
  </div>
  <div className="flex flex-wrap items-center gap-2">
   <Button type="button" size="sm" variant={filters.attention==="needs_attention"?"default":"outline"}
    onClick={()=>setFilters(f=>({...f,attention:f.attention==="needs_attention"?"all":"needs_attention",page:0}))}>
    {filters.attention==="needs_attention"?"Afficher tous les dossiers":"Afficher les dossiers à surveiller"}
   </Button>
   <p className="text-xs text-muted-foreground">Incident non résolu, retard ou proposition sans réponse depuis 24 h.</p>
  </div>
  {loading&&<p role="status">Chargement des résultats…</p>}
  {error&&<p role="alert">{error}</p>}
  {!loading&&!error&&result.items.length===0&&<p role="status" className="rounded-md border p-4">Aucune mission ne correspond à la recherche.</p>}
  {!error&&<div className="space-y-3">
    {result.items.map(m=><article key={m.id} className="rounded-xl border bg-card p-5">
     <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 className="font-semibold">{m.title}</h3>
      <span className="text-sm font-medium">{missionStatusLabel(m.status)}</span>
     </div>
     <p className="mt-2 text-sm">Technicien : {m.technician_name??"Profil indisponible"}
       {m.technician_city?" — "+m.technician_city:""}</p>
     <p className="mt-1 text-xs text-muted-foreground">
       Créée le {new Date(m.created_at).toLocaleString("fr-FR")}
       {m.scheduled_at?" · Intervention prévue le "+new Date(m.scheduled_at).toLocaleString("fr-FR"):""}
     </p>
     {missionAttentionLabel(m.attention_reason)&&<p className="mt-3 rounded-md border p-2 text-sm font-medium">
       À surveiller : {missionAttentionLabel(m.attention_reason)}
       {m.active_incidents>0?" · "+m.active_incidents+" incident(s) actif(s)":""}
     </p>}
     <MissionTimeline missionId={m.id}/>
    </article>)}
  </div>}
  {!error&&result.total>0&&<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
    <p role="status" className="text-sm">Résultats {page.from}–{page.to} sur {result.total} · page {filters.page+1} sur {Math.ceil(result.total/ADMIN_MISSION_PAGE_SIZE)}</p>
    <div className="flex gap-2">
     <Button type="button" variant="outline" disabled={loading||!page.canPrevious} onClick={()=>setFilters(f=>({...f,page:f.page-1}))}>Précédent</Button>
     <Button type="button" variant="outline" disabled={loading||!page.canNext} onClick={()=>setFilters(f=>({...f,page:f.page+1}))}>Suivant</Button>
    </div>
   </div>}
  <Link to="/gestion-incidents" className="text-sm underline">Traiter les incidents des missions</Link>
 </section>;
}
