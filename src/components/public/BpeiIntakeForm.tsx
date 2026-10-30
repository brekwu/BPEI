import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { validateBpeiInquiry, type BpeiInquiryKind, type BpeiInquiryDraft } from "@/lib/bpei-intake-validation";
import { classifyPublicInquiryFailure } from "@/lib/bpei-public-submission";

export function BpeiIntakeForm({kind}: {kind:BpeiInquiryKind}) {
  const [availability,setAvailability] = useState<"loading"|"open"|"closed"|"error">("loading");
  const [legalVersion,setLegalVersion] = useState<string|null>(null);
  const [draft,setDraft] = useState<BpeiInquiryDraft>({
    kind,client_name:"",email:"",phone:"",city:"",address_line1:"",postal_code:"",customer_kind:"individual",company_name:"",company_siret:"",subject:"",description:"",consent_accepted:false
  });
  const [trap,setTrap] = useState("");
  const [saving,setSaving] = useState(false);
  const [uncertain,setUncertain] = useState(false);
  const inFlight=useRef(false);
  const [message,setMessage] = useState("");
  const [sent,setSent] = useState(false);
  useEffect(()=>{
    let alive=true;
    const db=supabase as any;
    Promise.all([
      db.from("bpei_intake_flags").select("enabled").eq("kind",kind).maybeSingle(),
      db.from("bpei_launch_controls").select("legal_documents_published,legal_version").eq("id",true).maybeSingle(),
    ]).then(([flag,legal]:any[])=>{
      if(alive)setLegalVersion(legal.data?.legal_documents_published?legal.data?.legal_version??null:null);
      if(alive)setAvailability(flag.error||legal.error?"error":
        flag.data?.enabled===true && legal.data?.legal_documents_published===true && !!legal.data?.legal_version?"open":"closed");
    }).catch(()=>{if(alive)setAvailability("error")});
    return ()=>{alive=false};
  },[kind]);
  const set=(k:keyof BpeiInquiryDraft,v:string|boolean)=>setDraft(p=>({...p,[k]:v}));
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    // A state update is asynchronous. The ref is the immediate double-click lock.
    if(saving||inFlight.current||uncertain)return;
    if(trap){setMessage("Votre demande n'a pas pu être reçue.");return}
    const checked=validateBpeiInquiry(draft);
    if(!checked.ok){setMessage(checked.error);return}
    inFlight.current=true;
    setSaving(true);setMessage("");
    try{
      const {error}=await (supabase as any).from("bpei_inquiries").insert(checked.data);
      if(error){
        if(classifyPublicInquiryFailure(error)==="rejected"){
          setMessage("Envoi refusé. Le service est peut-être fermé ou certaines informations ne sont pas valides.");
        }else{
          // A transport error (or the server's duplicate guard) can follow a committed insert.
          // Never retry an ambiguous public request automatically.
          setUncertain(true);
          setMessage("Résultat non confirmé : votre demande a peut-être été enregistrée. Ne l'envoyez pas de nouveau ; contactez BPEI pour vérifier sa réception.");
        }
        return;
      }
      setSent(true);
      setMessage("Votre demande a été enregistrée. BPEI pourra vous contacter si le service est disponible dans votre secteur.");
    }catch{
      setUncertain(true);
      setMessage("Connexion interrompue : votre demande a peut-être été enregistrée. Ne l'envoyez pas de nouveau ; contactez BPEI pour vérifier sa réception.");
    }finally{
      inFlight.current=false;
      setSaving(false);
    }
  }
  if(availability==="loading")return <p role="status" className="mt-8 text-muted-foreground">Vérification de la disponibilité du formulaire…</p>;
  if(availability==="error")return <p role="alert" className="mt-8 rounded-lg border p-5">Le formulaire est temporairement indisponible. Aucune donnée n'est collectée.</p>;
  if(availability==="closed")return <div className="mt-8 rounded-lg border bg-muted/30 p-6" role="status">
    <h2 className="font-semibold">Formulaire en préparation</h2>
    <p className="mt-2 text-sm text-muted-foreground">La collecte des coordonnées ouvrira une fois les informations juridiques et les vérifications techniques finalisées. Aucune donnée n'est enregistrée ici pour le moment.</p>
  </div>;
  if(sent)return <p role="status" className="mt-8 rounded-lg border bg-card p-6">{message}</p>;
  return <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border bg-card p-6">
    <p className="text-sm text-muted-foreground">Les champs marqués * sont obligatoires. Ne communiquez jamais de mot de passe ni de donnée médicale dans la description.</p>
    <label className="block text-sm font-medium">Nom et prénom *<Input autoComplete="name" required maxLength={120} value={draft.client_name} onChange={e=>set("client_name",e.target.value)} /></label>
    <label className="block text-sm font-medium">E-mail *<Input type="email" autoComplete="email" required maxLength={254} value={draft.email} onChange={e=>set("email",e.target.value)} /></label>
    <label className="block text-sm font-medium">Téléphone {kind==="intervention"?"*":"(facultatif)"}<Input required={kind==="intervention"} minLength={kind==="intervention"?6:undefined} type="tel" autoComplete="tel" maxLength={40} value={draft.phone} onChange={e=>set("phone",e.target.value)} /></label>
    <label className="block text-sm font-medium">Ville {kind==="intervention"?"*":"(facultatif)"}<Input required={kind==="intervention"} autoComplete="address-level2" maxLength={120} value={draft.city} onChange={e=>set("city",e.target.value)} /></label>
    {kind==="intervention"&&<>
    <label className="block text-sm font-medium">Type de client *<select className="mt-1 w-full rounded-md border bg-background p-2" value={draft.customer_kind} onChange={e=>set("customer_kind",e.target.value)}><option value="individual">Particulier</option><option value="business">Entreprise</option></select></label>
    <label className="block text-sm font-medium">Adresse d’intervention / facturation *<Input autoComplete="street-address" required minLength={5} maxLength={200} value={draft.address_line1} onChange={e=>set("address_line1",e.target.value)} /></label>
    <label className="block text-sm font-medium">Code postal *<Input autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required value={draft.postal_code} onChange={e=>set("postal_code",e.target.value)}/></label>
    {draft.customer_kind==="business"&&<>
      <label className="block text-sm font-medium">Raison sociale *<Input required minLength={2} maxLength={160} value={draft.company_name} onChange={e=>set("company_name",e.target.value)}/></label>
      <label className="block text-sm font-medium">SIRET du client (facultatif)<Input maxLength={14} pattern="[0-9]{14}" value={draft.company_siret} onChange={e=>set("company_siret",e.target.value)}/></label>
    </>}
    </>}
    <label className="block text-sm font-medium">Sujet *<Input required minLength={3} maxLength={160} value={draft.subject} onChange={e=>set("subject",e.target.value)} /></label>
    <label className="block text-sm font-medium">Description *<Textarea required minLength={15} maxLength={3000} rows={5} value={draft.description} onChange={e=>set("description",e.target.value)} /></label>
    <div className="absolute -left-[9999px]" aria-hidden="true"><label htmlFor="bpei-hidden-address">Site web</label><input id="bpei-hidden-address" autoComplete="off" tabIndex={-1} value={trap} onChange={e=>setTrap(e.target.value)} /></div>
    <label className="flex gap-3 text-sm"><input type="checkbox" required checked={draft.consent_accepted} onChange={e=>set("consent_accepted",e.target.checked)}/><span>J'ai pris connaissance des informations relatives à ma demande et de la <Link to="/confidentialite" className="underline">politique de confidentialité</Link> (version {legalVersion}).</span></label>
    {message&&<p role="alert" className="text-sm text-destructive">{message}</p>}
    <Button type="submit" disabled={saving||uncertain}>{saving?"Envoi…":uncertain?"Envoi à vérifier":kind==="contact"?"Envoyer le message":"Envoyer la demande d'intervention"}</Button>
  </form>;
}
