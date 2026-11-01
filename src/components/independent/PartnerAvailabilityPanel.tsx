import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
type Slot={id:string;start_at:string;end_at:string;mode:string;status:string};
type Appointment={id:string;request_id:string;slot_id:string;status:string};
function format(t:string){return new Date(t).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});}
export function PartnerAvailabilityPanel({userId}:{userId:string}){
 const [slots,setSlots]=useState<Slot[]>([]);
 const [appointments,setAppointments]=useState<Appointment[]>([]);
 const [start,setStart]=useState("");
 const [end,setEnd]=useState("");
 const [mode,setMode]=useState<"on_site"|"remote">("on_site");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  const db=supabase as any;
  const [s,a]=await Promise.all([
   db.from("bpei_partner_availability_slots").select("id,start_at,end_at,mode,status")
    .eq("partner_id",userId).gte("start_at",new Date().toISOString()).order("start_at").limit(100),
   db.from("bpei_partner_appointments").select("id,request_id,slot_id,status")
    .eq("partner_id",userId).eq("status","confirmed").limit(100)
  ]);
  if(s.error||a.error)throw Error("read rejected");
  setSlots(s.data??[]);setAppointments(a.data??[]);
 },[userId]);
 useEffect(()=>{let active=true;refresh().catch(()=>{if(active)setError("Agenda indisponible.")});return()=>{active=false;setSlots([]);setAppointments([])}},[refresh]);
 const a=start?new Date(start).getTime():NaN,b=end?new Date(end).getTime():NaN;
 const valid=Number.isFinite(a)&&Number.isFinite(b)&&b>a&&b-a<=8*3600000&&a>Date.now()+10*60000&&a<Date.now()+180*86400000;
 async function add(){
  if(!valid||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await (supabase as any).from("bpei_partner_availability_slots").insert({
    partner_id:userId,start_at:new Date(a).toISOString(),end_at:new Date(b).toISOString(),mode,status:"available"
   });
   if(e)throw Error("slot unavailable");
   await refresh();setStart("");setEnd("");setNotice("Créneau déclaré. Une réservation n'est effective qu'après confirmation administrative.");
  }catch{setError("Créneau refusé : chevauchement, période invalide ou droits d'accès insuffisants.");}
  finally{setBusy(false)}
 }
 async function cancel(s:Slot){
  if(busy||!window.confirm("Retirer ce créneau non réservé ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await (supabase as any).rpc("cancel_own_availability",{p_slot_id:s.id});
   if(e)throw Error("cancel denied");
   await refresh();setNotice("Créneau retiré sans annuler une réservation existante.");
  }catch{setError("Ce créneau n'est plus modifiable. Pour déplacer une intervention, contactez BPEI.");}
  finally{setBusy(false)}
 }
 async function cancelAppointment(r:Appointment){
  if(busy)return;
  const reason=window.prompt("Motif d'annulation à transmettre à l'administration (au moins 20 caractères) :")?.trim();
  if(!reason||reason.length<20||reason.length>500)return;
  if(!window.confirm("Annuler le rendez-vous confirmé avec justification ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await (supabase as any).rpc("cancel_partner_appointment",{p_appointment_id:r.id,p_reason:reason});
   if(e)throw Error("cancel denied");
   await refresh();setNotice("Rendez-vous annulé. Une nouvelle date doit être convenue avec BPEI et le client.");
  }catch{setError("Annulation refusée : rendez-vous commencé ou statut non valide. Contactez BPEI.");}
  finally{setBusy(false)}
 }
 return <section className="rounded-xl border bg-card p-6" aria-label="Mes disponibilités">
  <h2 className="text-xl font-semibold">Mes disponibilités et rendez-vous</h2>
  <p className="mt-2 text-sm text-muted-foreground">Indiquez librement vos créneaux : aucun horaire imposé. Les horaires sont saisis dans le fuseau de votre navigateur puis enregistrés avec décalage horaire explicite. Un créneau publié ici ne garantit pas une réservation client.</p>
  <div className="mt-4 grid gap-3 sm:grid-cols-3">
   <label className="text-sm">Début<Input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label className="text-sm">Fin (8 h maximum)<Input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
   <label className="text-sm">Mode<select className="mt-1 w-full rounded border bg-background p-2" value={mode} onChange={e=>setMode(e.target.value as "on_site"|"remote")}>
    <option value="on_site">Intervention sur place</option><option value="remote">À distance</option>
   </select></label>
   <div className="sm:col-span-3"><Button type="button" disabled={busy||!valid} onClick={()=>void add()}>Ajouter ce créneau</Button></div>
  </div>
  <div className="mt-4 space-y-2">
   <h3 className="font-semibold">Créneaux futurs ({slots.length})</h3>
   {slots.length===0?<p className="text-sm text-muted-foreground">Aucune disponibilité déclarée.</p>:
    slots.map(s=><article key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm">
     <div><strong>{format(s.start_at)} — {format(s.end_at)}</strong>
      <p>{s.mode==="remote"?"Téléassistance":"Sur place"} · {s.status==="reserved"?"Réservé":s.status==="cancelled"?"Retiré":"Disponible"}</p></div>
     {s.status==="available"&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void cancel(s)}>Retirer</Button>}
     {s.status==="reserved"&&appointments.filter(a=>a.slot_id===s.id).map(a=>
      <Button key={a.id} size="sm" variant="outline" disabled={busy} onClick={()=>void cancelAppointment(a)}>Demander l'annulation</Button>)}
    </article>)}
  </div>
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
