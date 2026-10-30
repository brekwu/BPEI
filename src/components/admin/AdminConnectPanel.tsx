import {useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
const enabled=import.meta.env.VITE_BPEI_TEST_CONNECT_ENABLED==="true";
type Technician={id:string;name:string;siret:string|null;connected:boolean;approved:boolean;providerChecked:boolean};
export function AdminConnectPanel(){
 const [people,setPeople]=useState<Technician[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 async function load(){
  if(busy||!enabled)return;
  setBusy(true);setError("");
  try{
   const {data,error}=await supabase.functions.invoke("bpei-test-connect",{body:{action:"admin_list"}});
   if(error||data?.mode!=="test"||!Array.isArray(data.technicians))
    throw new Error("connect denied");
   setPeople(data.technicians);
  }catch{setError("Accès Stripe TEST indisponible : vérifier l'authentification et la configuration serveur.");}
  finally{setBusy(false);}
 }
 async function approve(id:string){
  if(busy||!enabled)return;
  if(!window.confirm("Confirmer la vérification professionnelle et autoriser UNIQUEMENT des paiements Stripe TEST pour cet indépendant ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {data,error}=await supabase.functions.invoke("bpei-test-connect",{body:{action:"approve",issuer_id:id}});
   if(error||data?.status!=="approved_test")throw new Error("not approved");
   setNotice("Compte indépendant approuvé pour la préproduction. Les paiements restent soumis au verrou global de la plateforme.");
   setPeople(x=>x.map(p=>p.id===id?{...p,approved:true,providerChecked:true}:p));
  }catch{setError("Approbation refusée. Vérifiez les pièces, l'identité et les capacités Stripe du vendeur.");}
  finally{setBusy(false);}
 }
 return <section aria-label="Comptes Stripe Connect des techniciens" className="rounded-lg border p-5">
  <h2 className="text-lg font-semibold">Paiements des prestataires — Stripe Connect</h2>
  <p className="mt-2 text-sm text-muted-foreground">Aucun encaissement réel ici. Seul un technicien professionnel vérifié et un compte marchand Stripe réellement opérationnel peuvent être approuvés en TEST. Les commissions restent à 0 par défaut.</p>
  {enabled?
   <Button className="mt-4" variant="outline" disabled={busy} onClick={()=>void load()}>Contrôler les prestataires Stripe</Button>:
   <p className="mt-3 text-sm" role="status">La liaison Stripe est suspendue jusqu'à la validation du compte plateforme.</p>}
  {people.length>0&&<div className="mt-4 space-y-3">
   {people.map(p=><article key={p.id} className="rounded border p-3 text-sm">
    <p className="font-semibold">{p.name} {p.siret&&<span>(SIRET {p.siret})</span>}</p>
    <p>{!p.connected?"Aucun compte Stripe lié":
      p.approved?"Approuvé pour les tests":
      p.providerChecked?"Validation finale BPEI à effectuer":
      "Vérification Stripe en attente"}</p>
    {p.connected&&!p.approved&&<Button className="mt-2" size="sm" variant="outline" disabled={busy} onClick={()=>void approve(p.id)}>Vérifier et approuver pour TEST</Button>}
   </article>)}
  </div>}
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
