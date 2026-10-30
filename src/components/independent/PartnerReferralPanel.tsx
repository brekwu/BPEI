import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {formatCents} from "@/lib/bpei-commercial";
type Referral={id:string;request_id:string;referral_fee_ht_cents:number;fee_basis:string;
 state:string;created_at:string;performing_partner_id:string};
export function PartnerReferralPanel({userId}:{userId:string}){
 const [offers,setOffers]=useState<Referral[]>([]);
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  const {data,error:e}=await (supabase as any).from("bpei_partner_referral_agreements")
   .select("id,request_id,referral_fee_ht_cents,fee_basis,state,created_at,performing_partner_id")
   .eq("referrer_id",userId).order("created_at",{ascending:false}).limit(100);
  if(e)throw Error("read denied");
  setOffers(data??[]);
 },[userId]);
 useEffect(()=>{let active=true;refresh().catch(()=>{if(active)setError("Propositions d'apport indisponibles.")});return()=>{active=false;setOffers([])}},[refresh]);
 async function reply(r:Referral,decision:"accepted"|"declined"){
  if(busy||!window.confirm(decision==="accepted"
   ?"Confirmer que vous acceptez les conditions financières d'apport décrites dans votre convention ?"
   :"Refuser librement cette proposition d'apport ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await (supabase as any).rpc("respond_partner_referral",{
    p_agreement_id:r.id,p_decision:decision
   });
   if(e)throw Error("decision denied");
   await refresh();setNotice("Votre choix a été enregistré. Aucun versement bancaire n'a été déclenché.");
  }catch{setError("Réponse impossible : proposition expirée, déjà traitée ou autorisation manquante.");}
  finally{setBusy(false)}
 }
 return <section className="rounded-xl border bg-card p-5" aria-label="Mes apports d'affaires">
  <h2 className="text-xl font-semibold">Mes apports d'affaires</h2>
  <p className="mt-2 text-sm text-muted-foreground">Vous pouvez présenter un client à un partenaire d'une autre région, avec son accord, sans réaliser la mission. Tout montant d'apport fait l'objet d'une proposition distincte que vous pouvez refuser librement ; il ne constitue pas une preuve de paiement.</p>
  {offers.length===0?<p className="mt-3 text-sm">Aucune rémunération d'apport proposée actuellement.</p>:
   <div className="mt-3 space-y-3">{offers.map(r=><article key={r.id} className="rounded border p-3 text-sm">
    <p><strong>Montant proposé : {formatCents(r.referral_fee_ht_cents)} HT</strong> · Mission {r.request_id.slice(0,8)}</p>
    <p className="mt-1">Conditions : {r.fee_basis}</p>
    <p>Statut : {r.state==="accepted"?"Acceptée":r.state==="declined"?"Refusée":"En attente de votre décision"}</p>
    {r.state==="proposed"&&<div className="mt-2 flex flex-wrap gap-2">
     <Button type="button" size="sm" disabled={busy} onClick={()=>void reply(r,"accepted")}>Accepter cet apport</Button>
     <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void reply(r,"declined")}>Refuser</Button>
    </div>}
   </article>)}</div>}
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
