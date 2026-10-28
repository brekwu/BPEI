import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Inquiry = {
 id:string; kind:"contact"|"intervention"; client_name:string; email:string; phone:string|null;
 city:string|null;subject:string;description:string;status:string;created_at:string;assigned_to:string|null;
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
 async function refresh(){
   setLoading(true);setError("");
   const db=supabase as any;
   const [i,p,a,m]=await Promise.all([
     db.from("bpei_inquiries").select("id,kind,client_name,email,phone,city,subject,description,status,created_at,assigned_to").order("created_at",{ascending:false}).limit(200),
     db.from("independent_profiles").select("user_id,display_name,city,verified_at").not("verified_at","is",null).limit(200),
     db.from("independent_applications").select("user_id,status").eq("status","approved").limit(200),
     db.from("independent_requests").select("inquiry_id,status,independent_id,created_at").not("inquiry_id","is",null).order("created_at",{ascending:false}).limit(400)
   ]);
   if(i.error||p.error||a.error||m.error)setError("La lecture des demandes et des indépendants a échoué. Vérifiez les autorisations.");
   else{
     const eligible=new Set(((a.data??[]) as {user_id:string}[]).map(x=>x.user_id));
     setTechnicians(((p.data??[]) as Technician[]).filter(x=>eligible.has(x.user_id)));
     setInquiries(i.data??[]);
     const latest:Record<string,{status:string;independent_id:string}>={};
     for(const mission of (m.data??[]) as {inquiry_id:string;status:string;independent_id:string}[]){
       if(!latest[mission.inquiry_id])latest[mission.inquiry_id]={status:mission.status,independent_id:mission.independent_id};
     }
     setMissionStatus(latest);
   }
   setLoading(false);
 }
 useEffect(()=>{void refresh()},[]);
 async function assign(i:Inquiry){
   const independent=selection[i.id];if(!independent||busy)return;
   if(!window.confirm("Confirmer l'attribution à ce professionnel vérifié ?"))return;
   setBusy(i.id);setError("");
   const {error:e}=await (supabase as any).rpc("assign_bpei_inquiry",{p_inquiry_id:i.id,p_independent_id:independent});
   if(e)setError("Attribution impossible : demande déjà traitée ou professionnel non vérifié.");
   else await refresh();
   setBusy(null);
 }
 async function close(i:Inquiry){
   if(busy||!window.confirm("Clore cette demande sans attribution ?"))return;
   setBusy(i.id);setError("");
   const {error:e}=await (supabase as any).rpc("close_bpei_inquiry",{p_inquiry_id:i.id});
   if(e)setError("La demande n'a pas pu être clôturée.");
   else await refresh();
   setBusy(null);
 }
 return <section className="mt-12 space-y-4" aria-label="Demandes clients">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-xl font-semibold">Demandes clients et messages</h2>
    <Link className="text-sm underline" to="/gestion-incidents">Gérer les incidents des missions</Link>
    <Button variant="outline" onClick={()=>void refresh()} disabled={loading||!!busy}>Actualiser</Button>
  </div>
  <p className="text-sm text-muted-foreground">Ces coordonnées personnelles sont réservées à l'équipe BPEI. Seuls les indépendants approuvés et vérifiés peuvent recevoir une mission.</p>
  {loading&&<p role="status">Chargement…</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {!loading&&inquiries.length===0&&<p className="text-sm text-muted-foreground">Aucun message ou demande d'intervention.</p>}
  {inquiries.map(i=><article key={i.id} className="space-y-3 rounded-xl border bg-card p-5">
    <div className="flex flex-wrap justify-between gap-2"><strong>{i.kind==="contact"?"Contact":"Intervention"} : {i.subject}</strong><span className="text-sm">{i.status}</span></div>
    <p className="text-sm">{i.client_name} · {i.email} · {i.city||"Ville non indiquée"} {i.phone?"· "+i.phone:""}</p>
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
