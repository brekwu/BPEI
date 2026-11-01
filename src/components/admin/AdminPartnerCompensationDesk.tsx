import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {euroToCents,formatCents} from "@/lib/bpei-commercial";
type Mission={id:string;title:string;status:string;independent_id:string;inquiry_id:string|null};
type Proposal={request_id:string;partner_id:string;client_price_ht_cents:number;technician_ht_cents:number;
 bpei_ht_cents:number;status:string;source:string};
const examples=[
 {level:"Junior",tech:50,bpei:40},{level:"Confirmé",tech:58,bpei:32},
 {level:"Expert",tech:64,bpei:26},{level:"Master",tech:70,bpei:20}
];
function centsZeroAllowed(v:string):number|null{
 const x=v.trim();if(!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(x))return null;
 const [e,d=""]=x.replace(",",".").split(".");
 const n=Number(e)*100+Number(d.padEnd(2,"0"));
 return Number.isSafeInteger(n)&&n>=0&&n<=20000000?n:null;
}
export function AdminPartnerCompensationDesk(){
 const [missions,setMissions]=useState<Mission[]>([]);
 const [existing,setExisting]=useState<Proposal[]>([]);
 const [names,setNames]=useState<Record<string,string>>({});
 const [id,setId]=useState("");
 const [source,setSource]=useState("bpei");
 const [total,setTotal]=useState("90");
 const [technician,setTechnician]=useState("50");
 const [bpei,setBpei]=useState("40");
 const [expense,setExpense]=useState("");
 const [contract,setContract]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  const db=supabase as any;
  const [r,p,profiles]=await Promise.all([
   db.from("independent_requests").select("id,title,status,independent_id,inquiry_id")
    .eq("status","new").not("inquiry_id","is",null).limit(100),
   db.from("bpei_partner_compensation_proposals")
    .select("request_id,partner_id,client_price_ht_cents,technician_ht_cents,bpei_ht_cents,status,source").limit(150),
   db.from("independent_profiles").select("user_id,display_name").limit(200)
  ]);
  if(r.error||p.error||profiles.error)throw Error("Unable to load missions");
  const rows=(r.data??[]) as Mission[];
  setMissions(rows);setExisting((p.data??[]) as Proposal[]);
  setNames(Object.fromEntries((profiles.data??[]).map((x:{user_id:string;display_name:string})=>[x.user_id,x.display_name])));
 },[]);
 useEffect(()=>{let mounted=true;refresh().catch(()=>{if(mounted)setError("Rémunérations indisponibles.")});return()=>{mounted=false;setMissions([]);setExisting([])}},[refresh]);
 const totalCents=euroToCents(total),techCents=centsZeroAllowed(technician),bpeiCents=centsZeroAllowed(bpei);
 const valid=!!id&&totalCents!==null&&techCents!==null&&bpeiCents!==null
  &&totalCents===techCents+bpeiCents&&expense.trim().length>=20&&contract.trim().length>=20
  &&!existing.some(x=>x.request_id===id);
 async function submit(){
  if(!valid||busy)return;
  if(!window.confirm("Confirmez-vous que le technicien connaît le prix, sa rémunération, les frais et la convention réellement signée ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await (supabase as any).rpc("propose_partner_compensation",{
    p_request_id:id,p_source:source,p_client_price_ht_cents:totalCents,
    p_technician_ht_cents:techCents,p_bpei_ht_cents:bpeiCents,
    p_expense_policy:expense.trim(),p_contractual_reference:contract.trim()
   });
   if(e)throw Error("proposal denied");
   await refresh();setNotice("Proposition enregistrée : le technicien devra l'accepter librement avant la mission.");
  }catch{setError("Proposition refusée. Vérifiez la mission, le dossier professionnel, les montants et la preuve contractuelle.");}
  finally{setBusy(false)}
 }
 const selected=missions.find(m=>m.id===id);
 return <section aria-label="Rémunération transparente des partenaires" className="rounded-xl border bg-card p-5">
  <h2 className="text-xl font-semibold">Propositions de rémunération des partenaires</h2>
  <p className="mt-2 text-sm text-muted-foreground">Ces sommes sont des montants HT à convenir contractuellement, pas des versements effectués. Un indépendant reste libre de refuser. Les frais de déplacement et éventuels coûts Stripe/TVA doivent être expliqués avant validation.</p>
  <div className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
   {examples.map(e=><div className="rounded border p-2" key={e.level}>
    <strong>{e.level}</strong><p>Exemple 90 € HT</p><p>Technicien {e.tech} €</p><p>BPEI {e.bpei} €</p>
   </div>)}
  </div>
  <p className="mt-2 text-xs text-muted-foreground">Barème uniquement illustratif et modifiable par proposition. Pour un client apporté par le technicien, la commission réduite de 10 % est une hypothèse à confirmer dans sa convention. Les partages ne sont pas encore reliés au moteur de virements Stripe.</p>
  <div className="mt-4 grid gap-3 sm:grid-cols-2">
   <label className="text-sm sm:col-span-2">Mission non acceptée
    <select className="mt-1 w-full rounded border bg-background p-2" value={id} onChange={e=>setId(e.target.value)}>
     <option value="">Sélectionner une intervention</option>
     {missions.filter(m=>!existing.some(p=>p.request_id===m.id)).map(m=><option key={m.id} value={m.id}>
      {m.title} — {names[m.independent_id]??"Technicien"}
     </option>)}
    </select></label>
   {selected&&<p className="text-sm sm:col-span-2">Partenaire : {names[selected.independent_id]??"À identifier"}</p>}
   <label className="text-sm">Origine de la clientèle
    <select className="mt-1 w-full rounded border bg-background p-2" value={source} onChange={e=>setSource(e.target.value)}>
     <option value="bpei">Client apporté par BPEI</option>
     <option value="partner">Client apporté par le technicien</option>
     <option value="referral">Client apporté par un autre partenaire</option>
    </select></label>
   <label className="text-sm">Prix client HT (€) *<Input required value={total} onChange={e=>setTotal(e.target.value)} inputMode="decimal"/></label>
   <label className="text-sm">Part du technicien HT (€) *<Input required value={technician} onChange={e=>setTechnician(e.target.value)} inputMode="decimal"/></label>
   <label className="text-sm">Part BPEI HT (€) *<Input required value={bpei} onChange={e=>setBpei(e.target.value)} inputMode="decimal"/></label>
   <label className="text-sm sm:col-span-2">Déplacements, frais, matériels et modalités de remboursement (20 à 500 caractères) *
    <Textarea value={expense} maxLength={500} onChange={e=>setExpense(e.target.value)}/></label>
   <label className="text-sm sm:col-span-2">Référence du contrat et tarif accepté par les parties (20 à 500 caractères) *
    <Input value={contract} minLength={20} maxLength={500} onChange={e=>setContract(e.target.value)}/></label>
   <div className="sm:col-span-2">
    {totalCents!==null&&techCents!==null&&bpeiCents!==null&&
     <p className="mb-2 text-sm">Total : {formatCents(totalCents)} HT · Part technicien : {formatCents(techCents)} HT · BPEI : {formatCents(bpeiCents)} HT
      {totalCents!==techCents+bpeiCents&&<strong className="ml-2 text-destructive">Les montants ne correspondent pas</strong>}</p>}
    <Button type="button" disabled={!valid||busy} onClick={()=>void submit()}>Transmettre la rémunération à accepter</Button>
   </div>
  </div>
  {existing.length>0&&<div className="mt-4 space-y-2"><h3 className="font-semibold">Propositions enregistrées</h3>
   {existing.map(e=><p key={e.request_id} className="text-sm">
    {names[e.partner_id]??"Partenaire"} — {formatCents(e.technician_ht_cents)} HT pour le technicien sur {formatCents(e.client_price_ht_cents)} HT · {e.status==="accepted"?"Acceptée":e.status==="declined"?"Refusée":"En attente"}
   </p>)}
  </div>}
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
