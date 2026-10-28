import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {
 PERIOD_OPTIONS,EXPORT_MAX_ROWS,exportIncidentCsv,formatDurationHours,
 type IncidentStatistics,type IncidentExportRow
} from "@/lib/bpei-incident-reports";

function saveTextFile(name:string,content:string,mime:string){
 const blob=new Blob([content],{type:mime});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement("a");
 anchor.href=url;anchor.download=name;
 document.body.appendChild(anchor);anchor.click();anchor.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function AdminIncidentStatistics(){
 const [days,setDays]=useState<7|30|90>(30);
 const [data,setData]=useState<IncidentStatistics|null>(null);
 const [busy,setBusy]=useState(false);
 const [exportBusy,setExportBusy]=useState(false);
 const [error,setError]=useState("");
 const [revision,setRevision]=useState(0);

 useEffect(()=>{
  let active=true;
  setBusy(true);setError("");
  (async()=>{
   const {data:result,error:e}=await (supabase as any).rpc("bpei_admin_incident_statistics",{p_days:days});
   if(!active)return;
   if(e||!result||typeof result.total!=="number"){
     setError("Statistiques indisponibles : vérifiez votre rôle administrateur.");setData(null);
   } else setData(result as IncidentStatistics);
   setBusy(false);
  })().catch(()=>{
   if(active){setError("Connexion aux statistiques indisponible.");setData(null);setBusy(false);}
  });
  return ()=>{active=false;};
 },[days,revision]);

 async function exportCsv(){
  if(exportBusy)return;
  setExportBusy(true);setError("");
  try{
   const db=supabase as any;
   const {data:userResult,error:userError}=await supabase.auth.getUser();
   if(userError||!userResult.user)throw new Error("not_logged_in");
   const {data:admin,error:adminError}=await db.from("independent_admins")
      .select("user_id").eq("user_id",userResult.user.id).maybeSingle();
   if(adminError||!admin)throw new Error("admin_required");
   const end=new Date();
   const start=new Date(end.getTime()-days*86400000);
   let counter=db.from("bpei_mission_incidents")
     .select("id",{count:"exact",head:true})
     .gte("created_at",start.toISOString()).lte("created_at",end.toISOString());
   const {count,error:countError}=await counter;
   if(countError||count===null)throw new Error("count_failed");
   if(count>EXPORT_MAX_ROWS)throw new Error("limit_exceeded");
   const rows:IncidentExportRow[]=[];
   for(let offset=0;offset<count;offset+=250){
    const {data:page,error:e}=await db.from("bpei_mission_incidents")
     .select("id,request_id,category,status,priority,created_at,reviewed_at,target_at,assigned_admin_id,resolution_note")
     .gte("created_at",start.toISOString()).lte("created_at",end.toISOString())
     .order("created_at",{ascending:false}).order("id",{ascending:false})
     .range(offset,Math.min(count-1,offset+249));
    if(e||!page)throw new Error("download_failed");
    rows.push(...page as IncidentExportRow[]);
   }
   if(rows.length!==count)throw new Error("changed_data");
   const filename="bpei-incidents-"+days+"j-"+end.toISOString().slice(0,10)+".csv";
   saveTextFile(filename,exportIncidentCsv(rows),"text/csv;charset=utf-8");
  }catch(e){
   const reason=e instanceof Error?e.message:"unknown";
   setError(reason==="limit_exceeded"?
     "Plus de 1 000 incidents dans la période. Réduisez la période pour éviter un export incomplet.":
     "Export impossible : vérifiez les autorisations et réessayez. Aucun fichier partiel n'a été enregistré.");
  }finally{setExportBusy(false);}
 }
 const metrics:{label:string;value:string;details:string}[]=[
  {label:"Incidents créés",value:String(data?.total??0),details:"Tous statuts"},
  {label:"Ouverts",value:String(data?.open??0),details:"Pas encore pris en charge"},
  {label:"En cours",value:String(data?.under_review??0),details:"En cours d'examen"},
  {label:"Résolus",value:String(data?.resolved??0),details:"Résolus parmi les incidents créés dans la période"},
  {label:"Non attribués",value:String(data?.unassigned??0),details:"Uniquement les incidents non résolus"},
  {label:"Échéance dépassée",value:String(data?.overdue??0),details:"Objectif interne, hors garantie contractuelle"},
  {label:"Critiques actifs",value:String(data?.critical_active??0),details:"Incidents critiques non résolus"},
  {label:"Délai moyen de résolution",value:formatDurationHours(data?.average_resolution_hours??null),details:"Durée entre création et clôture des incidents résolus"}
 ];
 return <section aria-label="Statistiques des incidents" className="space-y-4 rounded-xl border bg-card p-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div><h2 className="text-xl font-semibold">Statistiques des incidents</h2>
      <p className="text-sm text-muted-foreground">Cohortes selon la date de création de l'incident, en temps réel.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy||exportBusy} onClick={()=>setRevision(x=>x+1)}>Actualiser</Button>
      <Button size="sm" variant="outline" disabled={busy||exportBusy||!data} onClick={()=>void exportCsv()}>
       {exportBusy?"Préparation…":"Exporter CSV"}
      </Button>
    </div>
  </div>
  <div className="flex flex-wrap gap-2" aria-label="Période statistique">
   {PERIOD_OPTIONS.map(d=><Button key={d} size="sm" type="button" variant={d===days?"default":"outline"}
     disabled={busy||exportBusy} onClick={()=>setDays(d)}>{d} jours</Button>)}
  </div>
  {busy&&<p role="status">Calcul des statistiques…</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {!busy&&data&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
   {metrics.map(x=><article className="rounded-lg border p-3" key={x.label}>
     <p className="text-sm text-muted-foreground">{x.label}</p>
     <p className="mt-2 text-2xl font-semibold">{x.value}</p>
     <p className="mt-1 text-xs text-muted-foreground">{x.details}</p>
   </article>)}
  </div>}
  {!busy&&data&&<p className="text-sm text-muted-foreground">
    Répartition des priorités : basse {data.low}, normale {data.normal}, haute {data.high}, critique {data.critical}.
  </p>}
  <p className="text-xs text-muted-foreground">Le CSV contient des identifiants internes et des notes de résolution potentiellement confidentielles. Il est préparé uniquement dans votre navigateur, limité à 1 000 lignes et ne doit pas être partagé sans contrôle. Aucun envoi externe automatique.</p>
 </section>;
}
