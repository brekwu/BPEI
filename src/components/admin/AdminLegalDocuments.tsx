import {useEffect,useRef,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";

type Kind="mentions-legales"|"confidentialite"|"cgu";
type Doc={kind:Kind;version:string;content:string;approved_at:string};
const DOCS: {kind:Kind;label:string}[]=[
 {kind:"mentions-legales",label:"Mentions légales"},
 {kind:"confidentialite",label:"Politique de confidentialité"},
 {kind:"cgu",label:"Conditions générales d'utilisation"},
];
export function AdminLegalDocuments(){
 const [version,setVersion]=useState("bpei-2026-v1");
 const latestVersion=useRef(version);
 latestVersion.current=version;
 const refreshEpoch=useRef(0);
 const [loadedVersion,setLoadedVersion]=useState<string|null>(null);
 const [drafts,setDrafts]=useState<Record<Kind,string>>({"mentions-legales":"","confidentialite":"","cgu":""});
 const [docs,setDocs]=useState<Doc[]>([]);
 const [published,setPublished]=useState<string|null>(null);
 const [lockedVersions,setLockedVersions]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 // Drafts and approval history are private admin records. When a readback
 // cannot be verified, fail closed instead of displaying stale documents.
 function clearLoadedLegalData(){
   setLoadedVersion(null);
   setDocs([]);
   setDrafts({"mentions-legales":"","confidentialite":"","cgu":""});
   setPublished(null);
   setLockedVersions([]);
 }
 async function refresh():Promise<boolean>{
   const requestedVersion=version;
   const epoch=++refreshEpoch.current;
   clearLoadedLegalData();
   try{
    const db=supabase as any;
    const [d,c,h]=await Promise.all([
      db.from("bpei_legal_documents").select("kind,version,content,approved_at").eq("version",requestedVersion).limit(3),
      db.from("bpei_launch_controls").select("legal_documents_published,legal_version").eq("id",true).maybeSingle(),
      db.from("bpei_legal_releases").select("version").limit(100)
   ]);
   // Only the response for the active version may change legal drafts or locks.
   if(epoch!==refreshEpoch.current||latestVersion.current!==requestedVersion)return false;
   if(d.error||c.error||h.error||!c.data){
     clearLoadedLegalData();
     setNotice("Lecture juridique refusée ou incomplète : anciens documents masqués. Actualisez ou changez de version après avoir vérifié votre session.");
     return false;
   }
   setLockedVersions((h.data??[]).map((v:{version:string})=>v.version));
   setDocs(d.data??[]);
   setDrafts(Object.fromEntries(DOCS.map(x=>[x.kind,(d.data??[]).find((doc:Doc)=>doc.kind===x.kind)?.content??""])) as Record<Kind,string>);
   setPublished(c.data?.legal_documents_published?c.data.legal_version:null);
   setLoadedVersion(requestedVersion);
   return true;
   }catch{
     if(epoch===refreshEpoch.current&&latestVersion.current===requestedVersion){
       clearLoadedLegalData();
       setNotice("Service juridique indisponible : anciens documents masqués. Changez de version ou rechargez la page pour réessayer.");
     }
     return false;
   }
 }
 useEffect(()=>{
   void refresh();
   return ()=>{++refreshEpoch.current;};
 },[version]);
 async function approve(kind:Kind){
   const content=drafts[kind]?.trim();
   if(busy||loadedVersion!==version||lockedVersions.includes(version)||!content||content.length<300||content.length>50000)return;
   if(!window.confirm("Confirmez-vous avoir vérifié les informations juridiques et validé personnellement ce document ?"))return;
   setBusy(true);setNotice("");
   try{
     const {error}=await (supabase as any).rpc("approve_bpei_legal_document",{p_kind:kind,p_version:version,p_content:content});
     if(error)setNotice("Validation refusée : vérifiez le compte administrateur et le contenu.");
     else if(await refresh())setNotice("Document validé. Il n'est pas encore publié.");
     else setNotice("Validation potentiellement enregistrée, mais relecture indisponible. Aucun document précédent n'est affiché : vérifiez avant de recommencer.");
   }catch{setNotice("Service juridique indisponible. Vérifiez le statut du document avant de recommencer.");}
   finally{setBusy(false);}
 }
 async function publish(){
   if(busy||loadedVersion!==version||docs.length!==3||lockedVersions.includes(version)||DOCS.some(({kind})=>docs.find(d=>d.kind===kind)?.content!==drafts[kind].trim()))return;
   if(!window.confirm("CONFIRMATION : publier les trois documents juridiques de cette version ? Les inscriptions resteront fermées. Les documents publiés deviendront non modifiables."))return;
   setBusy(true);setNotice("");
   try{
     const {error}=await (supabase as any).rpc("publish_bpei_legal_documents",{p_version:version});
     if(error)setNotice("Publication refusée. Vérifiez les trois documents approuvés.");
     else if(await refresh())setNotice("Documents publiés. Les inscriptions restent fermées jusqu'à la recette SMTP et l'autorisation explicite.");
     else setNotice("Publication potentiellement enregistrée, mais impossible à relire. Vérifiez la version avant toute nouvelle tentative.");
   }catch{setNotice("Publication non confirmée. Vérifiez les documents et la version avant toute nouvelle tentative.");}
   finally{setBusy(false);}
 }
 return <section aria-label="Documents juridiques BPEI" className="mt-12 space-y-4 border-t pt-8">
   <h2 className="text-xl font-semibold">Documents juridiques et publication</h2>
   <p className="text-sm text-muted-foreground">Réservé aux administrateurs BPEI. Toute version publiée est non modifiable ; créez une nouvelle version pour les changements. La validation des documents doit être effectuée par une personne autorisée et informée des obligations de l'exploitant.</p>
   <label className="block max-w-sm text-sm font-medium">Version juridique (3 à 90 caractères)
     <input className="mt-1 block w-full rounded-md border bg-background p-2" required minLength={3} maxLength={90} pattern="[A-Za-z0-9._-]+" value={version} disabled={busy} onChange={e=>{
       const next=e.target.value.replace(/[^A-Za-z0-9._-]/g,"");
       if(next!==version){
         ++refreshEpoch.current;
         setLoadedVersion(null);
         setDocs([]);
         setDrafts({"mentions-legales":"","confidentialite":"","cgu":""});
         setNotice("");
         setVersion(next);
       }
     }}/>
   </label>
   {loadedVersion!==version&&<p className="text-sm" role="status">Chargement ou validation des documents de cette version en cours. Les actions sont désactivées.</p>}
   <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void refresh()}>Recharger les documents</Button>
   {published&&<p className="text-sm" role="status">Version actuellement publiée : <strong>{published}</strong>. Les inscriptions ne sont pas ouvertes automatiquement.</p>}
   {DOCS.map(({kind,label})=>(
    <div key={kind} className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{label}</h3><span className="text-sm text-muted-foreground">{docs.some(d=>d.kind===kind)?"Validé pour cette version":"Non validé"}</span></div>
      <textarea className="mt-3 block w-full rounded-md border bg-background p-3 text-sm" rows={10} maxLength={50000} disabled={busy||loadedVersion!==version||lockedVersions.includes(version)} value={drafts[kind]} onChange={e=>setDrafts(old=>({...old,[kind]:e.target.value}))} placeholder="Insérez le document complet et juridiquement vérifié. Aucun texte provisoire ne doit être publié." />
      <div className="mt-3 flex justify-between gap-3 text-xs text-muted-foreground"><span>{drafts[kind].trim().length} caractères (minimum 300)</span>
        <Button size="sm" variant="outline" disabled={busy||loadedVersion!==version||lockedVersions.includes(version)||drafts[kind].trim().length<300||drafts[kind].trim().length>50000||version.length<3} onClick={()=>void approve(kind)}>Valider ce document</Button>
      </div>
    </div>
   ))}
   <Button disabled={busy||loadedVersion!==version||docs.length!==3||lockedVersions.includes(version)||DOCS.some(({kind})=>docs.find(d=>d.kind===kind)?.content!==drafts[kind].trim())} onClick={()=>void publish()}>Publier les 3 documents validés</Button>
   <p className="text-xs text-muted-foreground">Publication juridique ≠ ouverture du recrutement. Les inscriptions et demandes clients resteront fermées jusqu'au contrôle SMTP et à la recette utilisateur.</p>
   {notice&&<p className="text-sm" role="status">{notice}</p>}
 </section>;
}
