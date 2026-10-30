import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
type Mission={id:string;title:string;independent_id:string;status:string};
type Slot={id:string;partner_id:string;start_at:string;end_at:string;mode:string;status:string};
type Appointment={id:string;request_id:string;slot_id:string;status:string};
const label=(v:string)=>new Date(v).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});
export function AdminSchedulingPanel(){
 const [missions,setMissions]=useState<Mission[]>([]);
 const [slots,setSlots]=useState<Slot[]>([]);
 const [appointments,setAppointments]=useState<Appointment[]>([]);
 const [missionId,setMissionId]=useState("");const [slotId,setSlotId]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  const db=supabase as any;
  const [m,s,a]=await Promise.all([
   db.from("independent_requests").select("id,title,independent_id,status").eq("status","accepted").limit(150),
   db.from("bpei_partner_availability_slots").select("id,partner_id,start_at,end_at,mode,status")
    .eq("status","available").gte("start_at",new Date().toISOString()).order("start_at").limit(200),
   db.from("bpei_partner_appointments").select("id,request_id,slot_id,status")
    .eq("status","confirmed").limit(200)
  ]);
  if(m.error||s.error||a.error)throw Error("read failed");
  setMissions(m.data??[]);setSlots(s.data??[]);setAppointments(a.data??[]);
 },[]);
 useEffect(()=>{let active=true;refresh().catch(()=>{if(active)setError("Agenda des missions indisponible.")});return()=>{active=false;setMissions([]);setSlots([]);setAppointments([])}},[refresh]);
 const selected=missions.find(m=>m.id===missionId);
 const choices=slots.filter(s=>s.partner_id===selected?.independent_id&&
  !appointments.some(a=>a.slot_id===s.id)&&new Date(s.start_at).getTime()>Date.now()+600000);
 async function reserve(){
  if(busy||!missionId||!slotId)return;
  if(!window.confirm("Avez-vous recueilli l'accord du client ET du prestataire sur ce rendez-vous ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await (supabase as any).rpc("confirm_partner_appointment",{
    p_request_id:missionId,p_slot_id:slotId
   });
   if(e)throw Error("reservation denied");
   await refresh();setSlotId("");setNotice("Date enregistrée sur la mission. Prévenir le client par le canal déjà convenu ; aucun e-mail n'a été envoyé automatiquement.");
  }catch{setError("Réservation refusée : créneau indisponible, mission non acceptée ou partenaire non habilité.");}
  finally{setBusy(false)}
 }
 return <section className="rounded-xl border bg-card p-5" aria-label="Rendez-vous du réseau">
  <h2 className="text-xl font-semibold">Réservation des missions</h2>
  <p className="mt-2 text-sm text-muted-foreground">Seul un administrateur confirme une date avec un partenaire déjà engagé sur la mission, après accord des parties. Aucun rendez-vous n'est présenté comme réservé sans confirmation serveur.</p>
  <div className="mt-4 space-y-3">
   <label className="block text-sm">Intervention acceptée
    <select className="mt-1 w-full rounded border bg-background p-2" value={missionId}
     onChange={e=>{setMissionId(e.target.value);setSlotId("")}}>
     <option value="">Choisir une mission</option>
     {missions.filter(m=>!appointments.some(a=>a.request_id===m.id)).map(m=><option key={m.id} value={m.id}>{m.title} ({m.id.slice(0,8)})</option>)}
    </select></label>
   <label className="block text-sm">Créneau proposé par le partenaire
    <select className="mt-1 w-full rounded border bg-background p-2" value={slotId} onChange={e=>setSlotId(e.target.value)}>
     <option value="">Choisir le créneau convenu</option>
     {choices.map(s=><option key={s.id} value={s.id}>{label(s.start_at)} à {label(s.end_at)} · {s.mode==="remote"?"À distance":"Sur place"}</option>)}
    </select></label>
   <Button type="button" disabled={busy||!selected||!slotId||!choices.some(s=>s.id===slotId)}
    onClick={()=>void reserve()}>Confirmer le rendez-vous convenu</Button>
  </div>
  <p className="mt-3 text-xs text-muted-foreground">Pour les annulations, utiliser la procédure partenaire ou le suivi des incidents : la date initiale et son motif restent tracés en base.</p>
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
