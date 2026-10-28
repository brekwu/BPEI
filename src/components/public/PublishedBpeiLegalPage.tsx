import {useEffect,useState} from "react";
import {Link} from "@tanstack/react-router";
import {supabase} from "@/integrations/supabase/client";
import {PublicShell} from "@/components/public/PublicShell";
export type BpeiLegalKind="mentions-legales"|"confidentialite"|"cgu";
type Published={version:string;content:string;approved_at:string};
export function PublishedBpeiLegalPage({title,kind}:{title:string;kind:BpeiLegalKind}){
 const [loading,setLoading]=useState(true);
 const [document,setDocument]=useState<Published|null>(null);
 const [unavailable,setUnavailable]=useState(false);
 useEffect(()=>{
   let active=true;const db=supabase as any;
   async function load(){
     try{
       const gate=await db.from("bpei_launch_controls").select("legal_documents_published,legal_version").eq("id",true).maybeSingle();
       if(gate.error)throw gate.error;
       if(!gate.data?.legal_documents_published||!gate.data.legal_version){if(active)setLoading(false);return}
       const res=await db.from("bpei_legal_documents").select("version,content,approved_at").eq("kind",kind).eq("version",gate.data.legal_version).maybeSingle();
       if(res.error)throw res.error;
       if(active){setDocument(res.data??null);setLoading(false)}
     }catch{if(active){setUnavailable(true);setLoading(false)}}
   }
   void load();return()=>{active=false};
 },[kind]);
 return <PublicShell><section className="mx-auto max-w-3xl px-4 py-16">
  <h1 className="text-3xl font-bold">{title}</h1>
  {loading?<p className="mt-5 text-muted-foreground" role="status">Chargement du document…</p>:
   unavailable?<p className="mt-5 text-muted-foreground" role="alert">Ce document est momentanément indisponible. La collecte des candidatures reste conditionnée à sa publication.</p>:
   document?<><p className="mt-3 text-sm text-muted-foreground">Version {document.version} — validée le {new Date(document.approved_at).toLocaleDateString("fr-FR")}</p>
    <article className="mt-8 whitespace-pre-wrap break-words leading-7 text-foreground">{document.content}</article></>:
   <p className="mt-5 text-muted-foreground" role="status">Ce document n'est pas encore publié et validé pour le nouveau réseau BPEI. Les anciens contrats réservés aux boutiques ne s'appliquent pas aux indépendants.</p>}
  <Link to="/" className="mt-8 inline-block underline">Retour à l'accueil</Link>
 </section></PublicShell>;
}
