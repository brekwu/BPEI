import {useEffect,useState} from "react";
import {Link} from "@tanstack/react-router";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {MissionTimeline} from "@/components/shared/MissionTimeline";
import {missionStatusLabel} from "@/lib/bpei-mission-status";
import {filterMissionStatus,missionStatusFilters} from "@/lib/bpei-mission-events";

type Mission={
 id:string;title:string;status:string;created_at:string;updated_at:string;
 scheduled_at:string|null;independent_id:string;inquiry_id:string|null
};
type Technician={user_id:string;display_name:string;city:string|null};
export function AdminMissionBoard(){
 const [missions,setMissions]=useState<Mission[]>([]);
 const [technicians,setTechnicians]=useState<Record<string,Technician>>({});
 const [filter,setFilter]=useState("all");
 const [query,setQuery]=useState("");
 const [loading,setLoading]=useState(true);
 const [page,setPage]=useState(0);
 const [total,setTotal]=useState(0);
 const pageSize=50;
 const [error,setError]=useState("");
 async function refresh(){
  setLoading(true);setError("");
  const db=supabase as any;
  const m=await db.from("independent_requests")
   .select("id,title,status,created_at,updated_at,scheduled_at,independent_id,inquiry_id",{count:"exact"})
   .order("created_at",{ascending:false}).order("id",{ascending:false})
   .range(page*pageSize,(page+1)*pageSize-1);
  if(m.error){setError("Lecture des missions impossible. Vérifiez les autorisations.");}
  else{
   const rows=(m.data??[]) as Mission[];
   const ids=[...new Set(rows.map(m=>m.independent_id))];
   const p=ids.length
    ?await db.from("independent_profiles").select("user_id,display_name,city").in("user_id",ids)
    :{data:[],error:null};
   if(p.error)setError("Lecture des profils impossible. Vérifiez les autorisations.");
   else{
    setMissions(rows);setTotal(m.count??0);
    setTechnicians(Object.fromEntries(((p.data??[]) as Technician[]).map(t=>[t.user_id,t])));
   }
  }
  setLoading(false);
 }
 useEffect(()=>{void refresh()},[page]);
 const shown=missions.filter(m=>filterMissionStatus(m.status,filter)&&(
  !query.trim()||m.title.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))||
  (technicians[m.independent_id]?.display_name??"").toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))
 ));
 return <section aria-label="Suivi des missions" className="space-y-5">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h2 className="text-xl font-semibold">Suivi des missions ({total})</h2>
   <Button type="button" variant="outline" size="sm" disabled={loading} onClick={()=>void refresh()}>Actualiser</Button>
  </div>
  <p className="text-sm text-muted-foreground">Les étapes sont enregistrées automatiquement. L'historique n'est pas modifiable depuis le tableau de bord.</p>
  <div className="flex flex-wrap gap-2">
   {missionStatusFilters.map(([value,label])=><Button type="button" size="sm" key={value}
     variant={filter===value?"default":"outline"} onClick={()=>setFilter(value)}>
     {label} ({value==="all"?missions.length:missions.filter(m=>m.status===value).length})
   </Button>)}
  </div>
  <label className="block text-sm">Rechercher une mission ou un technicien
   <input className="mt-1 block w-full max-w-lg rounded-md border bg-background p-2"
      value={query} onChange={e=>setQuery(e.target.value)} placeholder="Titre ou nom du technicien"/>
  </label>
  {loading&&<p role="status">Chargement des missions…</p>}
  {error&&<p role="alert">{error}</p>}
  {!loading&&!error&&shown.length===0&&<p className="text-sm text-muted-foreground">Aucune mission correspondant aux critères.</p>}
  <p className="text-xs text-muted-foreground">Recherche et compteurs par statut appliqués à la page affichée uniquement ({missions.length} missions sur cette page).</p>
  <div className="flex items-center gap-3">
   <Button type="button" variant="outline" size="sm" disabled={loading||page===0} onClick={()=>setPage(p=>Math.max(0,p-1))}>Précédent</Button>
   <span className="text-sm">Page {page+1} sur {Math.max(1,Math.ceil(total/pageSize))}</span>
   <Button type="button" variant="outline" size="sm" disabled={loading||(page+1)*pageSize>=total} onClick={()=>setPage(p=>p+1)}>Suivant</Button>
  </div>
  <div className="space-y-4">
   {shown.map(m=><article key={m.id} className="rounded-xl border bg-card p-5">
    <div className="flex flex-wrap justify-between gap-2">
     <h3 className="font-semibold">{m.title}</h3>
     <span className="text-sm font-medium">{missionStatusLabel(m.status)}</span>
    </div>
    <p className="mt-2 text-sm">Technicien : {technicians[m.independent_id]?.display_name??"Profil indisponible"}
      {technicians[m.independent_id]?.city?" — "+technicians[m.independent_id].city:""}</p>
    <p className="mt-1 text-xs text-muted-foreground">
      Créée le {new Date(m.created_at).toLocaleString("fr-FR")}
      {m.scheduled_at?" · Prévue le "+new Date(m.scheduled_at).toLocaleString("fr-FR"):""}
    </p>
    <MissionTimeline missionId={m.id}/>
   </article>)}
  </div>
  <Link to="/gestion-incidents" className="text-sm underline">Consulter les incidents de missions</Link>
 </section>;
}
