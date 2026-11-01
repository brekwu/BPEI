import {useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
const testConnectUI=import.meta.env.VITE_BPEI_TEST_CONNECT_ENABLED==="true";
type Result={status:string;approved:boolean;ready:boolean;mode:string;url?:string};
const labels:Record<string,string>={
 not_connected:"Compte Stripe non encore relié",
 onboarding:"Saisie des informations Stripe en cours",
 onboarding_required:"Informations bancaires/professionnelles à terminer chez Stripe",
 awaiting_bpei_approval:"Compte Stripe vérifié, validation BPEI en attente",
 approved_test:"Compte prêt pour les paiements de TEST"
};
export function IndependentConnectPanel(){
 const [state,setState]=useState<Result|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function action(request:"status"|"start"){
  if(busy||!testConnectUI)return;
  setBusy(true);setError("");
  try{
   const {data,error}=await supabase.functions.invoke("bpei-test-connect",{body:{action:request}});
   if(error||data?.mode!=="test"||typeof data.status!=="string")
    throw new Error("Connect disabled or refused");
   setState(data);
  }catch{setError("Connexion Stripe indisponible : vérification professionnelle, documents juridiques ou configuration BPEI manquants.");}
  finally{setBusy(false);}
 }
 return <section aria-label="Connexion de votre compte Stripe" className="rounded-xl border bg-card p-6">
  <h2 className="text-xl font-semibold">Encaissements de mes interventions</h2>
  <p className="mt-2 text-sm text-muted-foreground">Chaque indépendant est payé sur son propre compte Stripe Connect. La liaison, l'identité et le compte bancaire sont validés directement par Stripe. La préproduction accepte exclusivement le mode test.</p>
  {!testConnectUI?<p className="mt-3 text-sm" role="status">Liaison Stripe non encore ouverte : le compte plateforme doit être vérifié avant toute activation.</p>:<>
   <div className="mt-4 flex flex-wrap gap-2">
    <Button type="button" variant="outline" disabled={busy} onClick={()=>void action("status")}>Contrôler mon statut</Button>
    <Button type="button" disabled={busy} onClick={()=>void action("start")}>Configurer mon compte Stripe TEST</Button>
   </div>
   {state&&<p className="mt-3 text-sm" role="status">{labels[state.status]??"Statut indisponible"}</p>}
   {state?.url&&<a className="mt-2 inline-block underline" target="_blank" rel="noopener noreferrer" href={state.url}>Ouvrir la vérification Stripe (TEST)</a>}
   {error&&<p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
  </>}
 </section>;
}
