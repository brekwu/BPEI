import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Inquiry = {
 id:string; kind:"contact"|"intervention"; client_name:string; email:string; phone:string|null;
 city:string|null;address_line1:string|null;postal_code:string|null;customer_kind:string;company_name:string|null;company_siret:string|null;subject:string;description:string;status:string;created_at:string;assigned_to:string|null;
};
type Technician = { user_id:string;display_name:string;city:string|null;verified_at:string|null };
export function AdminInquiries() {
 const [loading,setLoading]=useState(true);
 const [inquiries,setInquiries]=useState<Inquiry[]>([]);
 const [technicians,setTechnicians]=useState<Technician[]>([]);
 const [missionStatus,setMissionStatus]=useState<Record<string,{status:string;independent_id:string}>>({});
 const [selection,setSelection]=useState<Record<string,string>>({});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const mounted=useRef(false);
 const readEpoch=useRef(0);
 function clearPrivateData(){
   setInquiries([]);setTechnicians([]);setMissionStatus({});setSelection({});
 }
 async function refresh():Promise<boolean>{
   const run=++readEpoch.current;
   const current=()=>mounted.current&&run===readEpoch.current;
   setLoading(true);setError("");
   try{
    const db=supabase as any;
    const [i,p,a,m]=await Promise.all([
     db.from("bpei_inquiries").select("id,kind,client_name,email,phone,city,address_line1,postal_code,customer_kind,company_name,company_siret,subject,description,status,created_at,assigned_to").order("created_at",{ascending:false}).limit(200),
     db.from("independent_profiles").select("user_id,display_name,city,verified_at").not("verified_at","is",null).limit(200),
     db.from("independent_applications").select("user_id,status").eq("status","approved").limit(200),
     db.from("independent_requests").select("inquiry_id,status,independent_id,created_at").not("inquiry_id","is",null).order("created_at",{ascending:false}).limit(400)
   ]);
    if(!current())return false;
    if(i.error||p.error||a.error||m.error)throw Error("Read unavailable");
    const eligible=new Set(((a.data??[]) as {user_id:string}[]).map(x=>x.user_id));
    setTechnicians(((p.data??[]) as Technician[]).filter(x=>eligible.has(x.user_id)));
    setInquiries(i.data??[]);
    const latest:Record<string,{status:string;independent_id:string}>={};
    for(const mission of (m.data??[]) as {inquiry_id:string;status:string;independent_id:string}[]){
      if(!latest[mission.inquiry_id])latest[mission.inquiry_id]={status:mission.status,independent_id:mission.independent_id};
    }
    setMissionStatus(latest);
    return true;
   }catch{
    // Failed or denied reads must never leave previously loaded client PII on screen.
    if(current()){
      clearPrivateData();
      setError("La lecture des demandes et des indépendants a échoué. Vérifiez les autorisations.");
    }
    return false;
   }finally{
    if(current())setLoading(false);
   }
 }
 useEffect(()=>{
   mounted.current=true;
   void refresh();
   return ()=>{mounted.current=false;++readEpoch.current;};
 },[]);
 async function assign(i:Inquiry){
   const independent=selection[i.id];if(!independent||busy)return;
   if(!window.confirm("Confirmer l'attribution à ce professionnel vérifié ?"))return;
   setBusy(i.id);setError("");
   try{
     const {error:e}=await (supabase as any).rpc("assign_bpei_inquiry",{p_inquiry_id:i.id,p_independent_id:independent});
     if(e)throw Error("Assignment not accepted");
     if(!(await refresh())&&mounted.current)
       setError("Attribution peut-être enregistrée, mais sa confirmation est indisponible. Actualisez avant de recommencer.");
   }catch{
     if(mounted.current)setError("Attribution non confirmée. Actualisez le dossier avant toute nouvelle tentative.");
   }finally{
     if(mounted.current)setBusy(null);
   }
 }
 async function close(i:Inquiry){
   if(busy||!window.confirm("Clore cette demande sans attribution ?"))return;
   setBusy(i.id);setError("");
   try{
     const {error:e}=await (supabase as any).rpc("close_bpei_inquiry",{p_inquiry_id:i.id});
     if(e)throw Error("Close not accepted");
     if(!(await refresh())&&mounted.current)
       setError("Clôture peut-être enregistrée, mais sa confirmation est indisponible. Actualisez avant de recommencer.");
   }catch{
     if(mounted.current)setError("Clôture non confirmée. Actualisez le dossier avant toute nouvelle tentative.");
   }finally{
     if(mounted.current)setBusy(null);
   }
 }
 return <section className="mt-12 space-y-4" aria-label="Demandes clients">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-xl font-semibold">Demandes clients et messages</h2>
    <Link className="text-sm underline" to="/gestion-missions">Suivi des missions</Link>
    <Link className="text-sm underline" to="/gestion-incidents">Gérer les incidents des missions</Link>
    <Button variant="outline" onClick={()=>void refresh()} disabled={loading||!!busy}>Actualiser</Button>
  </div>
  <p className="text-sm text-muted-foreground">Ces coordonnées personnelles sont réservées à l'équipe BPEI. Seuls les indépendants approuvés et vérifiés peuvent recevoir une mission.</p>
  {loading&&<p role="status">Chargement…</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {!loading&&!error&&inquiries.length===0&&<p className="text-sm text-muted-foreground">Aucun message ou demande d'intervention.</p>}
  {!loading&&inquiries.map(i=><article key={i.id} className="space-y-3 rounded-xl border bg-card p-5">
    <div className="flex flex-wrap justify-between gap-2"><strong>{i.kind==="contact"?"Contact":"Intervention"} : {i.subject}</strong><span className="text-sm">{i.status}</span></div>
    <p className="text-sm">{i.customer_kind==="business"&&i.company_name?i.company_name+" · ":""}{i.client_name} · {i.email} {i.phone?"· "+i.phone:""}</p>
    <p className="text-sm">{[i.address_line1,i.postal_code,i.city].filter(Boolean).join(", ")||"Adresse incomplète"}{i.company_siret?" · SIRET client : "+i.company_siret:""}</p>
    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{i.description}</p>
    {i.status==="new"&&<div className="flex flex-wrap items-center gap-2">
      {i.kind==="intervention"&&<><label className="text-sm" htmlFor={"tech-"+i.id}>Professionnel :</label>
       <select id={"tech-"+i.id} className="h-10 max-w-xs rounded-md border bg-background p-2 text-sm" value={selection[i.id]??""} onChange={e=>setSelection(p=>({...p,[i.id]:e.target.value}))}>
        <option value="">Choisir un indépendant vérifié</option>
        {technicians.map(t=><option key={t.user_id} value={t.user_id}>{t.display_name} ({t.city||"ville non précisée"})</option>)}
       </select>
       <Button disabled={!selection[i.id]||!!busy} onClick={()=>void assign(i)}>Attribuer</Button></>}
      <Button variant="outline" disabled={!!busy} onClick={()=>void close(i)}>Clore</Button>
    </div>}
    {i.status==="assigned"&&<p className="text-xs text-muted-foreground">Mission attribuée — statut : {missionStatus[i.id]?.status??"chargement"} ; technicien : {missionStatus[i.id]?.independent_id??"non renseigné"}. Les changements d'étape sont réalisés par le professionnel.</p>}
  </article>)}
 </section>;
}
