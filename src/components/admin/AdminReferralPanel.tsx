import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {euroToCents,formatCents} from "@/lib/bpei-commercial";
type Fee={request_id:string;partner_id:string;bpei_ht_cents:number;source:string;status:string};
type Partner={user_id:string;display_name:string;city:string|null;siret:string|null};
type Referral={id:string;request_id:string;referrer_id:string;performing_partner_id:string;
 referral_fee_ht_cents:number;state:string};
export function AdminReferralPanel(){
 const [fees,setFees]=useState<Fee[]>([]);
 const [partners,setPartners]=useState<Partner[]>([]);
 const [referrals,setReferrals]=useState<Referral[]>([]);
 const [mission,setMission]=useState("");const [referrer,setReferrer]=useState("");
 const [amount,setAmount]=useState("");const [basis,setBasis]=useState("");const [proof,setProof]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  const db=supabase as any;
  const [f,p,r]=await Promise.all([
   db.from("bpei_partner_compensation_proposals")
    .select("request_id,partner_id,bpei_ht_cents,source,status")
    .eq("source","referral").eq("status","accepted").limit(200),
   db.from("independent_profiles").select("user_id,display_name,city,siret").limit(200),
   db.from("bpei_partner_referral_agreements")
    .select("id,request_id,referrer_id,performing_partner_id,referral_fee_ht_cents,state").limit(200)
  ]);
  if(f.error||p.error||r.error)throw Error("read denied");
  setFees(f.data??[]);setPartners(p.data??[]);setReferrals(r.data??[]);
 },[]);
 useEffect(()=>{let active=true;refresh().catch(()=>{if(active)setError("Contrats d'apport indisponibles.")});return()=>{active=false;setFees([]);setPartners([]);setReferrals([])}},[refresh]);
 const selected=fees.find(f=>f.request_id===mission);
 const euros=euroToCents(amount);
 const valid=!!selected&&!!referrer&&selected.partner_id!==referrer&&euros!==null&&euros<=selected.bpei_ht_cents
  &&basis.trim().length>=30&&proof.trim().length>=20&&!referrals.some(r=>r.request_id===mission);
 async function submit(){
  if(!valid||busy||euros===null)return;
  if(!window.confirm("La prestation est-elle réellement apportée par cet indépendant, et l'accord d'apport prévoit-il expressément cette rémunération HT ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await (supabase as any).rpc("propose_partner_referral",{
    p_request_id:mission,p_referrer_id:referrer,p_fee_ht_cents:euros,
    p_fee_basis:basis.trim(),p_evidence_reference:proof.trim()
   });
   if(e)throw Error("proposal denied");
   await refresh();setMission("");setReferrer("");setAmount("");setBasis("");setProof("");
   setNotice("Proposition d'apport enregistrée. L'apporteur doit encore l'accepter ; aucune somme n'est versée.");
  }catch{setError("Apport refusé. Vérifiez la rémunération de mission déjà acceptée, le SIRET actif de l'apporteur et la référence du contrat.");}
  finally{setBusy(false)}
 }
 return <section className="rounded-xl border bg-card p-5" aria-label="Rémunération des apporteurs">
  <h2 className="text-xl font-semibold">Apporteurs de missions interrégionales</h2>
  <p className="mt-2 text-sm text-muted-foreground">Un indépendant peut apporter une opportunité dans une autre ville sans exécuter la prestation. Le prestataire intervenant conserve sa propre rémunération ; l'apporteur est proposé sur une fraction documentée de la part BPEI. Il doit accepter librement. Pas de virement automatisé.</p>
  <div className="mt-4 grid gap-3 sm:grid-cols-2">
   <label className="text-sm sm:col-span-2">Mission avec origine « apporteur » et répartition déjà acceptée
    <select className="mt-1 w-full rounded border bg-background p-2" value={mission}
     onChange={e=>setMission(e.target.value)}>
     <option value="">Choisir une mission</option>
     {fees.filter(f=>!referrals.some(r=>r.request_id===f.request_id)).map(f=><option key={f.request_id} value={f.request_id}>
      {f.request_id.slice(0,8)} · part BPEI : {formatCents(f.bpei_ht_cents)} HT
     </option>)}
    </select></label>
   <label className="text-sm">Professionnel apporteur (distinct de l'intervenant)
    <select className="mt-1 w-full rounded border bg-background p-2" value={referrer} onChange={e=>setReferrer(e.target.value)}>
     <option value="">Choisir</option>
     {partners.filter(p=>p.user_id!==selected?.partner_id&&p.siret).map(p=><option key={p.user_id} value={p.user_id}>{p.display_name} — {p.city}</option>)}
    </select></label>
   <label className="text-sm">Rémunération de l'apporteur HT (€)
    <Input value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)} placeholder="À fixer contractuellement"/></label>
   <label className="text-sm sm:col-span-2">Base de calcul, frais et modalités (30 à 500 caractères)
    <Textarea value={basis} maxLength={500} onChange={e=>setBasis(e.target.value)} rows={2}/></label>
   <label className="text-sm sm:col-span-2">Référence contractuelle réellement vérifiée (20 à 500 caractères)
    <Input value={proof} maxLength={500} onChange={e=>setProof(e.target.value)}/></label>
   <div className="sm:col-span-2"><Button type="button" disabled={!valid||busy} onClick={()=>void submit()}>Soumettre l'accord à l'apporteur</Button></div>
  </div>
  {referrals.length>0&&<div className="mt-4 space-y-2">
   <h3 className="font-semibold">Apports enregistrés ({referrals.length})</h3>
   {referrals.map(r=><p key={r.id} className="text-sm">{partners.find(p=>p.user_id===r.referrer_id)?.display_name??"Apporteur"}
    · {formatCents(r.referral_fee_ht_cents)} HT · {r.state==="accepted"?"Accepté":r.state==="declined"?"Refusé":"En attente"}</p>)}
  </div>}
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
