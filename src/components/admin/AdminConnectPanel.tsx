import {useEffect,useRef,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";

const enabled=import.meta.env.VITE_BPEI_TEST_CONNECT_ENABLED==="true";
type Technician={id:string;name:string;siret:string|null;connected:boolean;approved:boolean;providerChecked:boolean};

/** Admin readback is the only source of status; a successful mutation is not a receipt. */
async function readVerifiedTestMerchants():Promise<Technician[]>{
 const {data,error}=await supabase.functions.invoke("bpei-test-connect",{body:{action:"admin_list"}});
 if(error||data?.mode!=="test"||!Array.isArray(data.technicians))
  throw new Error("connect list unavailable");
 const list=data.technicians as Technician[];
 if(list.some(t=>typeof t.id!=="string"||typeof t.name!=="string"
    ||typeof t.connected!=="boolean"||typeof t.approved!=="boolean"
    ||typeof t.providerChecked!=="boolean"))
  throw new Error("invalid merchant status");
 return list;
}

export function AdminConnectPanel(){
 const [people,setPeople]=useState<Technician[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const epoch=useRef(0);
 useEffect(()=>()=>{++epoch.current;},[]);

 async function load(){
  if(busy||!enabled)return;
  const request=++epoch.current;
  setBusy(true);setError("");setNotice("");
  setLoaded(false);setPeople([]); // Never display a previous authorization while rechecking.
  try{
   const list=await readVerifiedTestMerchants();
   if(request!==epoch.current)return;
   setPeople(list);setLoaded(true);
  }catch{
   if(request!==epoch.current)return;
   setPeople([]);setLoaded(false);
   setError("Lecture Stripe TEST non confirmée : anciens statuts masqués. Vérifiez les droits et la configuration serveur.");
  }finally{if(request===epoch.current)setBusy(false)}
 }

 async function approve(id:string){
  if(busy||!enabled)return;
  const candidate=people.find(p=>p.id===id);
  if(!candidate||!candidate.connected||candidate.approved||!candidate.providerChecked)return;
  if(!window.confirm("Confirmer la vérification professionnelle et autoriser UNIQUEMENT des paiements Stripe TEST pour cet indépendant ?"))return;
  const request=++epoch.current;
  setBusy(true);setError("");setNotice("");
  setPeople([]);setLoaded(false); // A write might succeed while its readback fails.
  let accepted=false;
  try{
   const {data,error}=await supabase.functions.invoke("bpei-test-connect",{body:{action:"approve",issuer_id:id}});
   if(error||data?.status!=="approved_test"||data?.mode!=="test"
      ||data?.ready!==true||data?.approved!==true)
    throw new Error("approval refused");
   accepted=true;
   const list=await readVerifiedTestMerchants();
   if(request!==epoch.current)return;
   const observed=list.find(p=>p.id===id);
   if(!observed?.connected||!observed.providerChecked||!observed.approved)
    throw new Error("approval readback mismatch");
   setPeople(list);setLoaded(true);
   setNotice("Approbation Stripe TEST confirmée par une nouvelle lecture serveur. Le verrou global de paiement reste indépendant.");
  }catch{
   if(request!==epoch.current)return;
   setPeople([]);setLoaded(false);
   setError(accepted
    ?"Action potentiellement enregistrée, mais impossible à confirmer par une nouvelle lecture. Aucun ancien statut n'est affiché. Rechargez avant de réessayer."
    :"Approbation Stripe TEST non confirmée. Vérifiez l'identité, les capacités du marchand et le dossier avant de réessayer.");
  }finally{if(request===epoch.current)setBusy(false)}
 }

 return <section aria-label="Comptes Stripe Connect des techniciens" className="rounded-lg border p-5">
  <h2 className="text-lg font-semibold">Paiements des prestataires — Stripe Connect</h2>
  <p className="mt-2 text-sm text-muted-foreground">Aucun encaissement réel ici. Seul un technicien professionnel vérifié et un compte marchand Stripe réellement opérationnel peuvent être approuvés en TEST. Les commissions restent à 0 par défaut.</p>
  {enabled?
   <Button className="mt-4" variant="outline" disabled={busy} onClick={()=>void load()}>{busy?"Vérification en cours…":"Contrôler les prestataires Stripe"}</Button>:
   <p className="mt-3 text-sm" role="status">La liaison Stripe est suspendue jusqu'à la validation du compte plateforme.</p>}
  {enabled&&loaded&&people.length===0&&<p className="mt-3 text-sm" role="status">Aucun partenaire Stripe TEST éligible à afficher.</p>}
  {enabled&&loaded&&people.length>0&&<div className="mt-4 space-y-3">
   {people.map(p=><article key={p.id} className="rounded border p-3 text-sm">
    <p className="font-semibold">{p.name} {p.siret&&<span>(SIRET {p.siret})</span>}</p>
    <p>{!p.connected?"Aucun compte Stripe lié":
      p.approved?"Approuvé pour les tests":
      p.providerChecked?"Validation finale BPEI à effectuer":
      "Vérification Stripe en attente"}</p>
    {p.connected&&!p.approved&&<Button className="mt-2" size="sm" variant="outline"
      disabled={busy||!p.providerChecked} onClick={()=>void approve(p.id)}>
      Vérifier et approuver pour TEST
    </Button>}
   </article>)}
  </div>}
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
