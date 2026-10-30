import {useRef,useState,type FormEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {validateBpeiInquiry,type BpeiInquiryDraft} from "@/lib/bpei-intake-validation";

type Source="phone"|"email"|"in_person";
const empty: BpeiInquiryDraft={
 kind:"intervention",client_name:"",email:"",phone:"",city:"",
 address_line1:"",postal_code:"",customer_kind:"individual",
 company_name:"",company_siret:"",subject:"",description:"",consent_accepted:false
};
export function AdminPrivateIntake({onCreated}:{onCreated:()=>void}){
 const [draft,setDraft]=useState<BpeiInquiryDraft>(empty);
 const [source,setSource]=useState<Source>("phone");
 const [reference,setReference]=useState("");
 const [busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const inFlight=useRef(false);
 const [error,setError]=useState("");
 const [success,setSuccess]=useState("");
 function set<K extends keyof BpeiInquiryDraft>(name:K,value:BpeiInquiryDraft[K]){
  setDraft(d=>({...d,[name]:value}));
 }
 async function submit(e:FormEvent){
  e.preventDefault();
  if(busy||inFlight.current||uncertain)return;
  setError("");setSuccess("");
  const check=validateBpeiInquiry(draft);
  if(!check.ok){setError(check.error);return;}
  if(reference.trim().length<12||reference.trim().length>300){
   setError("Indiquez une référence vérifiable du consentement ou de l'information transmise (12 caractères minimum).");return;
  }
  if(!window.confirm("Confirmez-vous que le client a reçu les informations de confidentialité en vigueur et que sa réponse est effectivement documentée ?"))return;
  inFlight.current=true;
  setBusy(true);
  try{
   const d=check.data;
   const {data:createdId,error:e}=await (supabase as any).rpc("mvp_admin_create_inquiry",{
    p_client_name:d.client_name,p_email:d.email,p_phone:d.phone,p_city:d.city,
    p_address_line1:d.address_line1,p_postal_code:d.postal_code,
    p_customer_kind:d.customer_kind,p_company_name:d.company_name,p_company_siret:d.company_siret,
    p_subject:d.subject,p_description:d.description,p_source:source,
    p_privacy_ack_confirmed:draft.consent_accepted,p_privacy_ack_reference:reference.trim()
   });
   if(e){
    // A structured policy / validation denial is not a successful write.
    // Network/transport errors can arrive AFTER an actual DB commit.
    if(["42501","22023","23514"].includes(String(e.code))){
     setError("Demande refusée : vérifiez le compte administrateur, les documents publiés et les informations client.");
    }else{
     setUncertain(true);
     setError("Résultat non confirmé : vérifiez si la demande existe déjà dans la liste avant toute nouvelle tentative.");
     try{onCreated()}catch{/* A failed panel refresh must not resend the RPC. */}
    }
    return;
   }
   if(typeof createdId!=="string"||!createdId){
    setUncertain(true);
    setError("Résultat non confirmé : vérifiez la liste des demandes avant toute nouvelle tentative.");
    try{onCreated()}catch{/* Never retry a possibly committed write. */}
    return;
   }
   setDraft(empty);setReference("");setUncertain(false);
   setSuccess("Demande enregistrée dans l'administration. Vérifiez les informations avant attribution.");
   try{onCreated()}catch{
    setSuccess("Demande enregistrée. Actualisez la liste des dossiers pour voir la nouvelle demande.");
   }
  }catch{
   setUncertain(true);
   setError("Connexion interrompue : la demande a peut-être été enregistrée. Vérifiez la liste avant toute nouvelle tentative.");
   try{onCreated()}catch{/* The callback cannot establish write failure. */}
  }finally{inFlight.current=false;setBusy(false);}
 }
 return <section aria-label="Saisie privée d'une intervention" className="mt-9 rounded-xl border bg-card p-5">
  <h2 className="text-xl font-semibold">Saisir une demande client reçue par téléphone</h2>
  <p className="mt-2 text-sm text-muted-foreground">Réservé aux administrateurs. L'enregistrement n'est possible qu'après publication des documents de confidentialité et information effective du client. Les formulaires publics restent fermés.</p>
  <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={e=>void submit(e)}>
   <label className="text-sm">Nom du client *<Input autoComplete="name" required minLength={2} maxLength={120} value={draft.client_name} onChange={e=>set("client_name",e.target.value)}/></label>
   <label className="text-sm">Téléphone du client *<Input autoComplete="tel" type="tel" required minLength={6} maxLength={40} value={draft.phone} onChange={e=>set("phone",e.target.value)}/></label>
   <label className="text-sm">E-mail du client *<Input autoComplete="email" type="email" required maxLength={254} value={draft.email} onChange={e=>set("email",e.target.value)}/></label>
   <label className="text-sm">Ville *<Input required minLength={2} maxLength={120} value={draft.city} onChange={e=>set("city",e.target.value)}/></label>
   <label className="text-sm">Adresse d'intervention *<Input required minLength={5} maxLength={200} autoComplete="street-address" value={draft.address_line1} onChange={e=>set("address_line1",e.target.value)}/></label>
   <label className="text-sm">Code postal *<Input required inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="postal-code" value={draft.postal_code} onChange={e=>set("postal_code",e.target.value)}/></label>
   <label className="text-sm">Type de client *<select className="mt-1 w-full rounded-md border bg-background p-2" value={draft.customer_kind} onChange={e=>set("customer_kind",e.target.value as "individual"|"business")}>
    <option value="individual">Particulier</option><option value="business">Entreprise</option>
   </select></label>
   {draft.customer_kind==="business"&&<>
    <label className="text-sm">Raison sociale *<Input required minLength={2} maxLength={160} value={draft.company_name} onChange={e=>set("company_name",e.target.value)}/></label>
    <label className="text-sm">SIRET client (facultatif)<Input inputMode="numeric" maxLength={14} pattern="[0-9]{14}" value={draft.company_siret} onChange={e=>set("company_siret",e.target.value)}/></label>
   </>}
   <label className="text-sm md:col-span-2">Objet de l'intervention *<Input required minLength={3} maxLength={160} value={draft.subject} onChange={e=>set("subject",e.target.value)}/></label>
   <label className="text-sm md:col-span-2">Description de la demande *<Textarea required minLength={15} maxLength={3000} value={draft.description} onChange={e=>set("description",e.target.value)}/></label>
   <label className="text-sm">Origine de la demande
    <select className="mt-1 w-full rounded-md border bg-background p-2" value={source} onChange={e=>setSource(e.target.value as Source)}>
     <option value="phone">Téléphone</option><option value="email">E-mail</option><option value="in_person">En personne</option>
    </select>
   </label>
   <label className="text-sm">Référence de l'accord / information du client *<Input required minLength={12} maxLength={300} value={reference} onChange={e=>setReference(e.target.value)} placeholder="ID du courriel, document signé ou trace du dossier"/></label>
   <label className="md:col-span-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" required checked={draft.consent_accepted} onChange={e=>set("consent_accepted",e.target.checked)}/>
    <span>Je confirme que le client a effectivement reçu l'information de confidentialité publiée et que sa réponse est documentée. Ne pas cocher à la place du client sans preuve.</span>
   </label>
   <div className="md:col-span-2">
    <Button type="submit" disabled={busy||uncertain||!draft.consent_accepted||reference.trim().length<12}>{busy?"Enregistrement…":uncertain?"Vérification du dossier requise":"Créer la demande d'intervention"}</Button>
    {uncertain&&<div className="mt-3 space-y-2" role="status">
     <p className="text-sm">Consultez et actualisez la liste des demandes clients. N'enregistrez pas de doublon si le dossier existe déjà.</p>
     <Button type="button" variant="outline" disabled={busy} onClick={()=>{
      if(window.confirm("Avez-vous vérifié dans la liste que cette demande n'existe pas déjà ?"))setUncertain(false);
     }}>J'ai vérifié : autoriser une nouvelle tentative</Button>
    </div>
   </div>
  </form>
  {error&&<p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
  {success&&<p className="mt-3 text-sm" role="status">{success}</p>}
 </section>;
}
