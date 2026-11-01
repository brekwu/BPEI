import {createFileRoute,Link} from "@tanstack/react-router";
import {useState,type FormEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import {PublicShell} from "@/components/public/PublicShell";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
export const Route=createFileRoute("/avis-client")({
 component:ReviewForm,
 head:()=>({meta:[{title:"Donner mon avis après une intervention BPEI"},{name:"robots",content:"noindex,nofollow"}]})
});
function ReviewForm(){
 const [token,setToken]=useState("");
 const [score,setScore]=useState(5);
 const [comment,setComment]=useState("");
 const [publish,setPublish]=useState(false);
 const [busy,setBusy]=useState(false);const [sent,setSent]=useState(false);const [error,setError]=useState("");
 async function submit(e:FormEvent){
  e.preventDefault();if(busy||sent)return;
  if(!/^[a-f0-9]{64}$/.test(token.trim())||comment.trim().length<20)return;
  setBusy(true);setError("");
  try{
   const {data,error:e}=await supabase.functions.invoke("bpei-customer-review",{
    body:{token:token.trim(),rating:score,comment:comment.trim(),public_consent:publish}
   });
   if(e||data?.status!=="received_pending_moderation")throw Error("refused");
   setSent(true);setToken("");
  }catch{setError("Votre invitation est peut-être expirée, déjà utilisée ou le service n'est pas encore ouvert. Contactez BPEI par le canal qui vous a transmis le lien.");}
  finally{setBusy(false)}
 }
 return <PublicShell><main className="mx-auto max-w-2xl px-4 py-12">
  <h1 className="text-3xl font-bold">Donner votre avis sur une intervention BPEI</h1>
  <p className="mt-3 text-muted-foreground">Réservé au client d'une intervention réellement terminée et facturée. Utilisez le code privé reçu de BPEI. Un code ne sert qu'une seule fois et expire au bout de 21 jours. Un retour ne garantit pas une publication ; aucune note n'est publiée sans votre accord distinct.</p>
  {sent?<div role="status" className="mt-6 rounded border p-5">
   <h2 className="font-semibold">Votre retour a été reçu</h2>
   <p className="mt-2">Il sera examiné selon les règles de modération. Si vous n'avez pas autorisé la publication, il restera privé. Pour exercer vos droits ou demander un retrait, contactez BPEI.</p>
   <Link to="/contact" className="mt-3 inline-block underline">Contacter BPEI</Link>
  </div>:
  <form onSubmit={e=>void submit(e)} className="mt-6 space-y-4 rounded-xl border p-5">
   <label className="block text-sm">Code confidentiel d'invitation
    <input className="mt-1 w-full rounded border bg-background p-2 font-mono" autoComplete="off"
     required pattern="[a-f0-9]{64}" minLength={64} maxLength={64} value={token} onChange={e=>setToken(e.target.value.toLowerCase())}/></label>
   <label className="block text-sm">Note sur 5
    <select className="mt-1 w-full rounded border bg-background p-2" value={score} onChange={e=>setScore(Number(e.target.value))}>
     {[1,2,3,4,5].map(v=><option key={v} value={v}>{v} / 5</option>)}
    </select></label>
   <label className="block text-sm">Votre expérience (20 à 1000 caractères)
    <Textarea required minLength={20} maxLength={1000} rows={5} value={comment} onChange={e=>setComment(e.target.value)}
     placeholder="Décrivez le déroulement et la qualité de l'intervention, sans information personnelle sensible."/></label>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={publish} onChange={e=>setPublish(e.target.checked)}/>
    J'accepte librement que ma note et mon commentaire, après modération, puissent être publiés sur le réseau BPEI. Je peux refuser sans conséquence sur ma prestation.</label>
   <p className="text-xs text-muted-foreground">Si vous ne cochez pas cette case, votre avis est destiné uniquement à l'équipe BPEI et ne pourra pas être publié. N'insérez pas de mot de passe ni de document personnel.</p>
   <Button disabled={busy||!/^[a-f0-9]{64}$/.test(token)||comment.trim().length<20} type="submit">Transmettre mon retour</Button>
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>}
 </main></PublicShell>;
}
