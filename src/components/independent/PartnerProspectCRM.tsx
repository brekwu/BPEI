import {useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
type Lead={id:string;client_name:string;client_email:string;city:string;opportunity_title:string;source:string;status:string;next_follow_up:string|null;created_at:string};
const statusLabels:Record<string,string>={new:"Nouveau",contacted:"Contacté",qualified:"Qualifié",quoted:"Devis proposé",won:"Gagné",lost:"Perdu"};
export function PartnerProspectCRM({userId}:{userId:string}){
 const [rows,setRows]=useState<Lead[]>([]);
 const [name,setName]=useState("");const [email,setEmail]=useState("");
 const [phone,setPhone]=useState("");const [city,setCity]=useState("");
 const [title,setTitle]=useState("");const [kind,setKind]=useState("business");
 const [source,setSource]=useState("partner");const [basis,setBasis]=useState("incoming_request");
 const [evidence,setEvidence]=useState("");const [notes,setNotes]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 async function refresh(){
  const {data,error:e}=await (supabase as any).from("bpei_partner_leads")
   .select("id,client_name,client_email,city,opportunity_title,source,status,next_follow_up,created_at")
   .eq("partner_id",userId).order("created_at",{ascending:false}).limit(100);
  if(e)throw Error("read rejected");
  setRows(data??[]);
 }
 useEffect(()=>{
  let active=true;
  refresh().catch(()=>{if(active)setError("Le carnet de prospects est inaccessible. Vérifiez l'ouverture juridique et votre session.")});
  const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
   if(event==="SIGNED_OUT"){setRows([]);setName("");setEmail("");setEvidence("");}
  });
  return ()=>{active=false;subscription.unsubscribe();setRows([]);};
 },[userId]);
 const canSubmit=name.trim().length>=2&&email.includes("@")&&city.trim().length>=2
  &&title.trim().length>=5&&evidence.trim().length>=20&&
  !(kind==="individual"&&basis==="legitimate_interest");
 async function submit(e:FormEvent){
  e.preventDefault();if(!canSubmit||busy)return;
  if(!window.confirm("Confirmer que ce prospect a une origine licite documentée et qu'il a reçu l'information RGPD adéquate ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:dbError}=await (supabase as any).from("bpei_partner_leads").insert({
    partner_id:userId,created_by:userId,client_name:name.trim(),
    client_email:email.trim().toLowerCase(),client_phone:phone.trim()||null,
    city:city.trim(),opportunity_title:title.trim(),client_type:kind,
    source,legal_basis:basis,legal_evidence:evidence.trim(),notes:notes.trim(),status:"new"
   });
   if(dbError)throw Error("insert denied");
   setName("");setEmail("");setPhone("");setCity("");setTitle("");setEvidence("");setNotes("");
   await refresh();setNotice("Prospect enregistré. Aucune prospection automatique n'a été envoyée.");
  }catch{setError("Enregistrement refusé : doublon possible, base légale, conditions publiées ou autorisation manquante.");}
  finally{setBusy(false)}
 }
 async function updateStatus(row:Lead,status:string){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const {error:dbError}=await (supabase as any).from("bpei_partner_leads").update({status})
    .eq("id",row.id).eq("partner_id",userId);
   if(dbError)throw Error("status failed");
   await refresh();
  }catch{setError("La mise à jour du statut du prospect a été refusée.");}
  finally{setBusy(false)}
 }
 return <section className="rounded-xl border bg-card p-6" aria-label="Mes prospects BPEI">
  <h2 className="text-xl font-semibold">Mon carnet de prospection</h2>
  <p className="mt-2 text-sm text-muted-foreground">Développez librement votre activité locale ou à distance. Aucun quota, horaire ni prospection automatique. Les contacts doivent avoir une origine licite, et chaque prospect est protégé contre les doublons de sujet dans le réseau.</p>
  <form onSubmit={e=>void submit(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
   <label className="text-sm">Nom du prospect *<Input required minLength={2} maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label>
   <label className="text-sm">E-mail *<Input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label className="text-sm">Téléphone (facultatif)<Input type="tel" maxLength={40} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
   <label className="text-sm">Ville *<Input required maxLength={120} value={city} onChange={e=>setCity(e.target.value)}/></label>
   <label className="text-sm sm:col-span-2">Besoin / opportunité *<Input required minLength={5} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <label className="text-sm">Client
    <select className="mt-1 w-full rounded border bg-background p-2" value={kind}
     onChange={e=>{setKind(e.target.value);if(e.target.value==="individual"&&basis==="legitimate_interest")setBasis("incoming_request")}}>
     <option value="business">Entreprise</option><option value="individual">Particulier</option>
    </select>
   </label>
   <label className="text-sm">Origine
    <select className="mt-1 w-full rounded border bg-background p-2" value={source} onChange={e=>setSource(e.target.value)}>
     <option value="partner">Trouvé par moi-même</option><option value="bpei">Apport BPEI</option><option value="referral">Apporteur tiers</option>
    </select>
   </label>
   <label className="text-sm">Base du contact
    <select className="mt-1 w-full rounded border bg-background p-2" value={basis} onChange={e=>setBasis(e.target.value)}>
     <option value="incoming_request">Demande entrante du client</option>
     <option value="explicit_consent">Consentement explicite documenté</option>
     {kind==="business"&&<option value="legitimate_interest">Intérêt légitime B2B, pertinence à évaluer</option>}
    </select>
   </label>
   <label className="text-sm sm:col-span-2">Référence de la preuve / information fournie *<Input required minLength={20} maxLength={500} value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Demande datée, accord documenté ou référence d'interaction professionnelle"/></label>
   <label className="text-sm sm:col-span-2">Notes facultatives (sans mots de passe)
    <Textarea rows={2} maxLength={1500} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
   <div className="sm:col-span-2"><Button disabled={busy||!canSubmit} type="submit">Enregistrer le prospect</Button></div>
  </form>
  {rows.length>0&&<div className="mt-5 space-y-3"><h3 className="font-semibold">Mes opportunités ({rows.length})</h3>
   {rows.map(r=><article key={r.id} className="rounded border p-3 text-sm">
    <strong>{r.opportunity_title}</strong> — {r.client_name}, {r.city}
    <p>Origine : {r.source==="partner"?"Prospection personnelle":r.source==="bpei"?"BPEI":"Apporteur"}</p>
    <p>Statut : {statusLabels[r.status]??r.status} · {new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
    <div className="mt-2 flex flex-wrap gap-2">
     <a href={"mailto:"+r.client_email} className="underline">Écrire au contact</a>
     <label>Changer le suivi
      <select className="ml-2 rounded border bg-background p-1" disabled={busy} value={r.status} onChange={e=>void updateStatus(r,e.target.value)}>
       {Object.entries(statusLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}
      </select>
     </label>
    </div>
   </article>)}
  </div>}
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
