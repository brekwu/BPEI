import {createFileRoute,Link} from "@tanstack/react-router";
import {useState,type FormEvent} from "react";
import {PublicShell} from "@/components/public/PublicShell";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {tierName} from "@/lib/bpei-partner-levels";
type Partner={display_name:string;city:string|null;postal_code:string|null;
 level:number;verified_skills:string[];remote_available:boolean};
export const Route=createFileRoute("/trouver-un-technicien")({
 component:SearchNetwork,
 head:()=>({meta:[
  {title:"Rechercher un technicien partenaire BPEI"},
  {name:"description",content:"Recherchez les partenaires BPEI réellement habilités par ville, code postal ou téléassistance. Aucune disponibilité locale n'est annoncée sans partenaire vérifié."}
 ]})
});
function SearchNetwork(){
 const [city,setCity]=useState("");
 const [postal,setPostal]=useState("");
 const [skill,setSkill]=useState("");
 const [remote,setRemote]=useState(false);
 const [results,setResults]=useState<Partner[]>([]);
 const [searched,setSearched]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function search(e:FormEvent){
  e.preventDefault();
  if(busy||(!remote&&city.trim().length<2&&!/^[0-9]{5}$/.test(postal.trim())))return;
  setBusy(true);setError("");setSearched(false);setResults([]);
  try{
   const {data,error:e}=await (supabase as any).rpc("search_active_partners",{
    p_city:city.trim()||null,p_postal_code:postal.trim()||null,
    p_remote:remote,p_skill:skill.trim()||null
   });
   if(e)throw new Error("directory unavailable");
   setResults(Array.isArray(data)?data:[]);
   setSearched(true);
  }catch{setError("Recherche momentanément indisponible. Vous pouvez laisser une demande de prise en charge si les formulaires sont ouverts.");}
  finally{setBusy(false);}
 }
 return <PublicShell><main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
  <h1 className="text-3xl font-bold">Trouver un technicien indépendant partenaire BPEI</h1>
  <p className="mt-3 text-muted-foreground">BPEI — Bureau des Partenaires et Entrepreneurs de l'Informatique — construit un réseau national de techniciens indépendants évalués, assurés et validés. Les villes sont couvertes uniquement lorsqu'un partenaire opérationnel y est effectivement inscrit.</p>
  <form onSubmit={e=>void search(e)} className="mt-6 grid gap-3 rounded-xl border bg-card p-5 sm:grid-cols-2">
   <label className="text-sm">Ville<Input value={city} maxLength={120} onChange={e=>setCity(e.target.value)} placeholder="Ex. Nice, Lyon, Lille"/></label>
   <label className="text-sm">Code postal<Input value={postal} maxLength={5} inputMode="numeric" pattern="[0-9]{5}" onChange={e=>setPostal(e.target.value)} placeholder="06000"/></label>
   <label className="text-sm sm:col-span-2">Compétence recherchée (optionnel)<Input value={skill} maxLength={80} onChange={e=>setSkill(e.target.value)} placeholder="Ordinateur, réseau, sauvegarde…"/></label>
   <label className="flex items-start gap-2 text-sm sm:col-span-2">
    <input type="checkbox" checked={remote} onChange={e=>setRemote(e.target.checked)} className="mt-1"/>
    Chercher un partenaire proposant du dépannage à distance, partout en France
   </label>
   <div className="sm:col-span-2"><Button type="submit" disabled={busy||(!remote&&city.trim().length<2&&!/^[0-9]{5}$/.test(postal.trim()))}>
    {busy?"Recherche…":"Rechercher les partenaires habilités"}</Button></div>
  </form>
  {error&&<p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
  {searched&&<section className="mt-7 space-y-4" aria-label="Résultats partenaires">
   <h2 className="text-xl font-semibold">Résultats ({results.length})</h2>
   {results.length===0?<p role="status">Aucun partenaire BPEI vérifié et référencé ne correspond actuellement à ces critères. Nous ne présentons pas une ville comme couverte sans technicien validé.</p>:
    <div className="grid gap-4 sm:grid-cols-2">{results.map((p,i)=><article key={i} className="rounded-xl border bg-card p-5">
     <h3 className="text-lg font-semibold">{p.display_name}</h3>
     <p className="mt-1 text-sm">Niveau : <strong>{tierName(p.level)}</strong></p>
     <p className="mt-1 text-sm">{p.city} {p.postal_code} {p.remote_available?"· Téléassistance possible":""}</p>
     {p.verified_skills.length>0&&<p className="mt-3 text-sm">Compétences évaluées : {p.verified_skills.join(", ")}</p>}
     <p className="mt-3 text-xs text-muted-foreground">Partenaire du réseau BPEI, juridiquement indépendant. Disponibilité et date d'intervention à confirmer.</p>
    </article>)}</div>}
   <Link to="/demander-une-intervention" className="inline-block underline">Décrire votre besoin et demander une intervention</Link>
  </section>}
  {!searched&&<p className="mt-6 text-sm text-muted-foreground">Les rayons d'intervention kilométriques et les créneaux en temps réel ne sont pas encore calculés ; cette recherche affiche seulement les correspondances exactes de ville/code postal ou les partenaires acceptant la distance.</p>}
 </main></PublicShell>;
}
