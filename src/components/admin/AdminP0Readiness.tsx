import {useCallback,useEffect,useRef,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";

type Gate={ready:boolean;verification?:string;evidence?:{reference:string;verified_at:string}|null;
 verified_accounts?:number;published?:boolean;outbox_provider_accepted?:number;
 active_test_merchants?:number;paid_test_attempts?:number;verified_users?:number;
 accepted_quotes?:number;invoices?:number;commission_reference?:unknown;
 e_invoice_reference?:unknown};
type Status={mode:"preproduction";all_ready:boolean;checked_at:string;checks:Record<string,Gate>};
const entries:{id:string;title:string;description:string;attestations:string[]}[]=[
 {id:"admin_account",title:"1. Premier compte administrateur",
  description:"Il doit exister dans Supabase Auth, avec une adresse e-mail personnellement confirmée et un rôle attribué explicitement. Jamais de promotion du premier inscrit.",attestations:[]},
 {id:"smtp_auth",title:"2. SMTP et confirmation d'inscription",
  description:"Un vrai SMTP personnalisé doit envoyer un lien de confirmation, réellement reçu et utilisé par un destinataire de test autorisé. La base ne peut pas inspecter les secrets SMTP.",attestations:["smtp_auth_delivery"]},
 {id:"legal",title:"3. Documents juridiques approuvés",
  description:"L'exploitant identifié et habilité doit approuver puis publier les vrais documents, contrats et informations de rétractation/médiation. Une attestation ne remplace pas leur validité juridique.",attestations:["legal_operator_review"]},
 {id:"commercial_email",title:"4. E-mails commerciaux et pièces jointes",
  description:"Le domaine d'envoi doit être vérifié, la livraison de la facture ou du devis doit être contrôlée par le vrai destinataire et le serveur doit avoir enregistré l'acceptation fournisseur.",attestations:["commercial_sender_receipt"]},
 {id:"commission_and_einvoice",title:"5. Commissions et plateforme de facturation électronique",
  description:"Documenter qui facture, qui encaisse, qui paie la TVA de la commission, la convention signée et la plateforme agréée choisie pour recevoir/émettre les factures selon les obligations applicables.",attestations:["partner_commission_signed","e_invoice_platform_receipt"]},
 {id:"stripe_test",title:"6. Compte Stripe et encaissement de TEST",
  description:"Compte marchand partenaire confirmé, montant/commission rapprochés, véritable test Checkout et webhook 'payé' contrôlé, sans transaction LIVE.",attestations:["stripe_test_payment"]},
 {id:"pilot_e2e",title:"7. Recette intégrale avant publicité",
  description:"Tester un vrai client et un vrai partenaire de préproduction, devis accepté, mission terminée, facture, e-mail, webhook, accès non autorisés et incident/remboursement.",attestations:["full_pilot_verified"]}
];
const attestLabels:Record<string,string>={
 smtp_auth_delivery:"Preuve de réception du lien Auth et SMTP personnalisé",
 legal_operator_review:"Référence d'approbation des vrais documents par l'exploitant",
 commercial_sender_receipt:"Référence de réception du PDF par le vrai destinataire",
 partner_commission_signed:"Convention partenaire et modèle de commission signés",
 e_invoice_platform_receipt:"Accusé de sélection / réception sur plateforme agréée",
 stripe_test_payment:"Trace du test Stripe Checkout + webhook",
 full_pilot_verified:"Rapport de recette réelle client/partenaire et incidents"
};
export function AdminP0Readiness(){
 const [data,setData]=useState<Status|null>(null);
 const [references,setReferences]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const mounted=useRef(false);
 const readEpoch=useRef(0);
 const clearPrivateData=useCallback(()=>{
  setData(null);
  setReferences({});
  setNotice("");
 },[]);
 const load=useCallback(async():Promise<boolean>=>{
  const run=++readEpoch.current;
  const current=()=>mounted.current&&run===readEpoch.current;
  // A previous P0 "ready" result must disappear while authorization is rechecked.
  setData(null);
  setError("");
  try{
   const {data:result,error:readError}=await (supabase as any).rpc("p0_readiness");
   if(!current())return false;
   if(readError||result?.mode!=="preproduction"||!result.checks){
    clearPrivateData();
    setError("Tableau P0 inaccessible : droits ou données non confirmés. Aucune validation antérieure n'est affichée.");
    return false;
   }
   setData(result as Status);
   return true;
  }catch{
   if(current()){
    clearPrivateData();
    setError("Tableau P0 inaccessible : session ou connexion non confirmée. Actualisez pour revérifier vos droits.");
   }
   return false;
  }
 },[clearPrivateData]);
 useEffect(()=>{
  mounted.current=true;
  void load();
  return ()=>{mounted.current=false;++readEpoch.current;};
 },[load]);
 async function attest(key:string,pass:boolean){
  if(busy)return;
  const reference=(references[key]??"").trim();
  if(pass&&reference.length<30)return;
  const message=pass
   ?"Confirmez-vous personnellement que cette vérification EXTERNE a réellement été réalisée et que votre référence en constitue la preuve ?"
   :"Retirer cette validation P0 ?";
  if(!window.confirm(message))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error}=await (supabase as any).rpc("record_p0_attestation",{
    p_check_key:key,p_evidence_reference:pass?reference:"",p_passed:pass
   });
   if(error)throw Error("attestation denied");
   if(!mounted.current)return;
   const confirmed=await load();
   if(!confirmed)return; // Never announce success when the authorized readback failed.
   if(pass)setReferences(v=>({...v,[key]:""}));
   setNotice(pass?"Preuve déclarée et associée à votre compte administrateur. Elle ne prouve pas automatiquement le résultat d'un fournisseur externe.":"Preuve retirée ; le verrou reste fermé.");
  }catch{
   if(mounted.current){
    clearPrivateData();
    setError("Attestation non confirmée : actualisez l'audit avant toute nouvelle tentative.");
   }
  }finally{if(mounted.current)setBusy(false);}
 }
 return <section className="mt-8 rounded-xl border bg-card p-5" aria-label="Audit P0 de lancement BPEI">
  <h2 className="text-xl font-semibold">Audit P0 — lancement commercial</h2>
  <p className="mt-2 text-sm text-muted-foreground">
   Diagnostic privé, fondé sur l'état de la base et des pièces de vérification attribuées à l'administrateur. Il ne contrôle pas directement les secrets SMTP/Stripe ou la conformité juridique. Il n'ouvre ni le recrutement public ni les paiements.
  </p>
  {data&&<>
   <p className="mt-3 font-semibold" role="status">{data.all_ready
    ?"Toutes les preuves du tableau sont réunies — revue finale humaine et essais LIVE encore nécessaires."
    :"Ouverture commerciale bloquée : des exigences P0 restent non validées."}</p>
   <p className="text-xs text-muted-foreground">Dernière lecture : {new Date(data.checked_at).toLocaleString("fr-FR")}</p>
   <div className="mt-5 space-y-4">{entries.map(item=>{
    const g=data.checks[item.id],ready=g?.ready===true;
    const found=item.attestations.filter(k=>{
     const exact=(g?.evidence??null) as unknown;
     if(k==="partner_commission_signed")return !!g?.commission_reference;
     if(k==="e_invoice_platform_receipt")return !!g?.e_invoice_reference;
     return !!exact;
    });
    return <article key={item.id} className="rounded-lg border p-4">
     <div className="flex flex-wrap items-center gap-2">
      <h3 className="font-semibold">{item.title}</h3>
      <span className="text-sm font-medium">{ready?"Validé selon les contrôles disponibles":"À vérifier / bloqué"}</span>
     </div>
     <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
     {g&&<p className="mt-2 text-xs">
      {g.verified_accounts!==undefined&&`Administrateurs confirmés : ${g.verified_accounts}. `}
      {g.outbox_provider_accepted!==undefined&&`Envois enregistrés chez le fournisseur : ${g.outbox_provider_accepted}. `}
      {g.active_test_merchants!==undefined&&`Marchands TEST actifs : ${g.active_test_merchants}. Paiements TEST confirmés : ${g.paid_test_attempts}. `}
      {g.verified_users!==undefined&&`Comptes confirmés : ${g.verified_users}. Devis acceptés : ${g.accepted_quotes}. Factures : ${g.invoices}. `}
     </p>}
     {item.attestations.map(k=><div key={k} className="mt-3 rounded border p-3">
      <p className="text-sm font-medium">{attestLabels[k]}</p>
      {found.includes(k)&&<p className="mt-1 text-xs">Preuve déjà enregistrée par un administrateur ; le contrôle automatique reste indépendant.</p>}
      <label className="mt-2 block text-sm">Référence de preuve vérifiée (30 à 500 caractères)
       <Input maxLength={500} minLength={30} value={references[k]??""}
        onChange={e=>setReferences(v=>({...v,[k]:e.target.value}))}
        placeholder="Date, identifiant d'essai, fournisseur et résultat réel — sans mot de passe ni clé API"/>
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
       <Button type="button" size="sm" variant="outline" disabled={busy||(references[k]??"").trim().length<30}
        onClick={()=>void attest(k,true)}>Attester avec preuve</Button>
       {found.includes(k)&&<Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void attest(k,false)}>Retirer la preuve</Button>}
      </div>
     </div>)}
    </article>
   })}</div>
  </>}
  <Button type="button" variant="outline" className="mt-4" disabled={busy} onClick={()=>void load()}>Actualiser les contrôles</Button>
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
