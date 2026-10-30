import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
type Mission={id:string;inquiry_id:string|null;status:string;title:string};
type Quote={id:string;inquiry_id:string;status:string};
type Invoice={quote_id:string};
type Client={id:string;email:string;client_name:string};
type Invite={request_id:string;recipient_email:string;issued_at:string;consumed_at:string|null};
type Review={id:string;request_id:string;rating:number;comment:string;customer_public_consent:boolean;
 moderation:string;submitted_at:string};
const reviewsUI=import.meta.env.VITE_BPEI_REVIEWS_ENABLED==="true";
export function AdminCustomerReviews(){
 const [missions,setMissions]=useState<Mission[]>([]);
 const [quotes,setQuotes]=useState<Quote[]>([]);
 const [invoices,setInvoices]=useState<Invoice[]>([]);
 const [clients,setClients]=useState<Client[]>([]);
 const [invites,setInvites]=useState<Invite[]>([]);
 const [reviews,setReviews]=useState<Review[]>([]);
 const [token,setToken]=useState("");
 const [recipient,setRecipient]=useState("");
 const [reason,setReason]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");const [notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{
  const db=supabase as any;
  const [m,q,i,c,t,r]=await Promise.all([
   db.from("independent_requests").select("id,inquiry_id,status,title").eq("status","completed").not("inquiry_id","is",null).limit(200),
   db.from("bpei_service_quotes").select("id,inquiry_id,status").eq("status","accepted").limit(200),
   db.from("bpei_service_invoices").select("quote_id").limit(200),
   db.from("bpei_inquiries").select("id,email,client_name").limit(200),
   db.from("bpei_review_invitations").select("request_id,recipient_email,issued_at,consumed_at").limit(200),
   db.from("bpei_customer_reviews").select("id,request_id,rating,comment,customer_public_consent,moderation,submitted_at").limit(200)
  ]);
  if([m,q,i,c,t,r].some(x=>x.error))throw Error("admin review data unavailable");
  setMissions(m.data??[]);setQuotes(q.data??[]);setInvoices(i.data??[]);
  setClients(c.data??[]);setInvites(t.data??[]);setReviews(r.data??[]);
 },[]);
 useEffect(()=>{
  let active=true;refresh().catch(()=>{if(active)setError("Avis clients indisponibles.")});
  const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
   if(event==="SIGNED_OUT"){setToken("");setRecipient("");setReviews([]);setInvites([])}
  });
  return()=>{active=false;subscription.unsubscribe();setToken("");setRecipient("")};
 },[refresh]);
 const available=missions.filter(m=>!invites.some(i=>i.request_id===m.id)
   &&!reviews.some(r=>r.request_id===m.id)
   &&quotes.some(q=>q.inquiry_id===m.inquiry_id&&invoices.some(i=>i.quote_id===q.id)));
 async function issue(m:Mission){
  if(!reviewsUI||busy)return;
  if(!window.confirm("L'avis doit être demandé UNIQUEMENT à l'adresse réellement fournie par le client de cette intervention facturée. Confirmer ?"))return;
  setBusy(true);setError("");setNotice("");setToken("");setRecipient("");
  try{
   const {data,error:e}=await (supabase as any).rpc("issue_review_invitation",{p_request_id:m.id});
   if(e||typeof data!=="string"||!/^[a-f0-9]{64}$/.test(data))throw Error("invite refused");
   await refresh();setToken(data);
   setRecipient(clients.find(x=>x.id===m.inquiry_id)?.email??"");
   setNotice("Code créé : il sera affiché une seule fois. Transmettez-le directement au client légitime ; aucun e-mail n'a été envoyé automatiquement.");
  }catch{setError("Invitation refusée : vérifier les documents juridiques publiés, la mission terminée et sa facture.");}
  finally{setBusy(false)}
 }
 async function copy(){
  if(!token)return;
  try{
   await navigator.clipboard.writeText(token);
   setNotice("Code copié. Envoyez-le uniquement au client de l'intervention par un canal privé.");
  }catch{setError("Copie impossible ; utilisez la sélection manuelle sans exposer le code publiquement.")}
 }
 async function moderate(r:Review,decision:"published"|"rejected"){
  if(busy||reason.trim().length<20)return;
  if(!window.confirm(decision==="published"
   ?"Publier la note de ce client après contrôle de son origine et de son consentement ?"
   :"Retirer ou refuser cet avis avec une justification documentée ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await (supabase as any).rpc("moderate_customer_review",{
    p_review_id:r.id,p_decision:decision,p_reason:reason.trim()
   });
   if(e)throw Error("moderation failed");
   await refresh();setReason("");setNotice("Avis modéré. Seules les évaluations publiées et consenties alimentent les statistiques publiques.");
  }catch{setError("Modération refusée. Vérifiez les droits, l'état de l'avis et le consentement client.");}
  finally{setBusy(false)}
 }
 return <section className="space-y-4 rounded-xl border bg-card p-5" aria-label="Avis clients vérifiés">
  <h2 className="text-xl font-semibold">Avis des clients après intervention</h2>
  <p className="text-sm text-muted-foreground">Une invitation unique ne peut être créée qu'après mission terminée et facture réelle. Le client utilise le code reçu et choisit séparément d'autoriser ou non la publication. Chaque publication est modérée. Aucune fausse note ni invitation automatique.</p>
  {!reviewsUI&&<p className="text-sm">Invitations désactivées sur cette préversion tant que le traitement juridique, le formulaire et le domaine d'origine ne sont pas validés.</p>}
  {token&&<div className="rounded border p-4 text-sm">
   <p className="font-semibold">Code client à usage unique</p>
   <p>Destinataire enregistré : {recipient||"À vérifier dans le dossier de la mission"}</p>
   <p className="mt-2 break-all font-mono">{token}</p>
   <p className="mt-2">Page à transmettre au client : <a href="/avis-client" target="_blank" rel="noopener noreferrer" className="underline">/avis-client</a> — le code est saisi par le client, pas placé dans un lien public.</p>
   <Button size="sm" variant="outline" type="button" onClick={()=>void copy()}>Copier le code</Button>
   <Button size="sm" type="button" variant="outline" onClick={()=>{setToken("");setRecipient("")}}>Masquer le code</Button>
  </div>}
  {available.length>0&&<div className="space-y-2">
   <h3 className="font-semibold">Interventions éligibles à une invitation</h3>
   {available.map(m=><article className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm" key={m.id}>
    <div><strong>{m.title}</strong><p>{clients.find(c=>c.id===m.inquiry_id)?.email??"Adresse à vérifier"}</p></div>
    <Button type="button" size="sm" disabled={busy||!reviewsUI} onClick={()=>void issue(m)}>Créer le code client</Button>
   </article>)}
  </div>}
  {invites.length>0&&<p className="text-sm">Invitations enregistrées : {invites.length}, dont {invites.filter(i=>i.consumed_at).length} utilisée(s).</p>}
  {reviews.length>0&&<div className="space-y-3"><h3 className="font-semibold">Avis reçus ({reviews.length})</h3>
   <label className="block text-sm">Justification de modération (20 à 500 caractères)
    <textarea rows={2} value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} className="mt-1 w-full rounded border bg-background p-2"/></label>
   {reviews.map(r=><article key={r.id} className="rounded border p-3 text-sm">
    <p><strong>{r.rating}/5</strong> · {r.moderation==="pending"?"En attente":r.moderation==="published"?"Publié":"Non publié"} · Publication autorisée : {r.customer_public_consent?"oui":"non"}</p>
    <p className="mt-2 whitespace-pre-wrap">{r.comment}</p>
    {(r.moderation==="pending"||r.moderation==="published")&&<div className="mt-2 flex flex-wrap gap-2">
     {r.moderation==="pending"&&r.customer_public_consent&&
      <Button type="button" size="sm" disabled={busy||reason.trim().length<20} onClick={()=>void moderate(r,"published")}>Publier l'avis vérifié</Button>}
     <Button type="button" size="sm" variant="outline" disabled={busy||reason.trim().length<20} onClick={()=>void moderate(r,"rejected")}>
      {r.moderation==="published"?"Retirer après signalement":"Ne pas publier"}</Button>
    </div>}
   </article>)}
  </div>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="text-sm">{notice}</p>}
 </section>;
}
