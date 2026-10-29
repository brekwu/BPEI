import {useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
type CheckoutDiagnostic={ready:boolean;mode:"test";reasons:string[];invoice_id?:string};
export function AdminTestCheckoutReadiness({invoiceId}:{invoiceId:string}){
 const [result,setResult]=useState<CheckoutDiagnostic|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function diagnose(){
  if(busy)return;
  setBusy(true);setError("");setResult(null);
  try{
   const {data,error:failure}=await (supabase as any).rpc(
    "mvp_test_checkout_readiness",{p_invoice_id:invoiceId}
   );
   if(failure||data?.mode!=="test"||typeof data.ready!=="boolean"
    ||!Array.isArray(data.reasons))throw Error("diagnostic rejected");
   setResult(data);
  }catch{setError("Diagnostic inaccessible. Vérifiez votre rôle administrateur et l'état de la facture.");}
  finally{setBusy(false);}
 }
 return <section className="mt-3 rounded border p-3 text-sm" aria-label="Contrôle du paiement Stripe TEST">
  <p className="font-semibold">Contrôle financier prépaiement (TEST)</p>
  <p className="mt-1 text-muted-foreground">Compare le devis, la facture, la rémunération HT réellement acceptée et la configuration des frais Stripe. Il ne crée aucun paiement.</p>
  <Button className="mt-2" size="sm" type="button" variant="outline" disabled={busy}
   onClick={()=>void diagnose()}>Vérifier la cohérence du paiement TEST</Button>
  {result&&<div className="mt-2" role="status">
   <strong>{result.ready?"Données cohérentes pour la préproduction (sous réserve des secrets et contrôles Stripe externes).":
    "Paiement de test bloqué — incohérences ou prérequis manquants"}</strong>
   {result.reasons.length>0&&<ul className="mt-2 list-disc space-y-1 pl-5">
    {result.reasons.map((r,i)=><li key={i}>{r}</li>)}
   </ul>}
  </div>}
  {error&&<p role="alert" className="mt-2 text-destructive">{error}</p>}
 </section>;
}
