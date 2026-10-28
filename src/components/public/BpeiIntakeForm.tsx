import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { validateBpeiInquiry, type BpeiInquiryKind, type BpeiInquiryDraft } from "@/lib/bpei-intake-validation";

export function BpeiIntakeForm({kind}: {kind:BpeiInquiryKind}) {
  const [availability,setAvailability] = useState<"loading"|"open"|"closed"|"error">("loading");
  const [legalVersion,setLegalVersion] = useState<string|null>(null);
  const [draft,setDraft] = useState<BpeiInquiryDraft>({
    kind,client_name:"",email:"",phone:"",city:"",subject:"",description:"",consent_accepted:false
  });
  const [trap,setTrap] = useState("");
  const [saving,setSaving] = useState(false);
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
    e.preventDefault();if(saving)return;
    if(trap){setMessage("Votre demande n'a pas pu être reçue.");return}
    const checked=validateBpeiInquiry(draft);
    if(!checked.ok){setMessage(checked.error);return}
    setSaving(true);setMessage("");
    const {error}=await (supabase as any).from("bpei_inquiries").insert(checked.data);
    setSaving(false);
    if(error){setMessage("Envoi impossible. Le service est peut-être encore fermé. Réessayez ultérieurement.");return}
    setSent(true);setMessage("Votre demande a été enregistrée. BPEI pourra vous contacter si le service est disponible dans votre secteur.");
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
    <label className="block text-sm font-medium">Téléphone (facultatif)<Input type="tel" autoComplete="tel" maxLength={40} value={draft.phone} onChange={e=>set("phone",e.target.value)} /></label>
    <label className="block text-sm font-medium">Ville {kind==="intervention"?"*":"(facultatif)"}<Input required={kind==="intervention"} autoComplete="address-level2" maxLength={120} value={draft.city} onChange={e=>set("city",e.target.value)} /></label>
    <label className="block text-sm font-medium">Sujet *<Input required minLength={3} maxLength={160} value={draft.subject} onChange={e=>set("subject",e.target.value)} /></label>
    <label className="block text-sm font-medium">Description *<Textarea required minLength={15} maxLength={3000} rows={5} value={draft.description} onChange={e=>set("description",e.target.value)} /></label>
    <div className="absolute -left-[9999px]" aria-hidden="true"><label htmlFor="bpei-hidden-address">Site web</label><input id="bpei-hidden-address" autoComplete="off" tabIndex={-1} value={trap} onChange={e=>setTrap(e.target.value)} /></div>
    <label className="flex gap-3 text-sm"><input type="checkbox" required checked={draft.consent_accepted} onChange={e=>set("consent_accepted",e.target.checked)}/><span>J'ai pris connaissance des informations relatives à ma demande et de la <Link to="/confidentialite" className="underline">politique de confidentialité</Link> (version {legalVersion}).</span></label>
    {message&&<p role="alert" className="text-sm text-destructive">{message}</p>}
    <Button type="submit" disabled={saving}>{saving?"Envoi…":kind==="contact"?"Envoyer le message":"Envoyer la demande d'intervention"}</Button>
  </form>;
}
