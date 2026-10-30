import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {tierName,indicativeLevelForMissions} from "@/lib/bpei-partner-levels";
type Tier={level:number|null;authorization_state:string;last_assessed_at:string|null};
export function IndependentLevelStatus({userId}:{userId:string}){
 const [tier,setTier]=useState<Tier|null>(null);
 const [count,setCount]=useState<number|null>(null);
 const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  const db=supabase as any;
  const [l,m]=await Promise.all([
   db.from("bpei_technician_levels").select("level,authorization_state,last_assessed_at")
    .eq("user_id",userId).maybeSingle(),
   db.from("independent_requests").select("id",{count:"exact",head:true})
    .eq("independent_id",userId).eq("status","completed")
  ]);
  if(l.error||m.error)throw Error("Unable to load partner level");
  setTier(l.data??null);setCount(m.count??0);
 },[userId]);
 useEffect(()=>{
  let active=true;setLoading(true);
  load().catch(()=>{if(active){setTier(null);setCount(null)}}).finally(()=>{if(active)setLoading(false)});
  return ()=>{active=false;setTier(null);setCount(null)};
 },[load]);
 return <section aria-label="Mon niveau dans le réseau BPEI" className="rounded-xl border bg-card p-6">
  <h2 className="text-xl font-semibold">Mon niveau dans le réseau BPEI</h2>
  {loading?<p role="status" className="mt-2">Lecture de mon niveau…</p>:<>
   <p className="mt-2">Niveau validé : <strong>{tier?.level?tierName(tier.level):"Non évalué"}</strong></p>
   <p className="mt-1 text-sm">Autorisation de nouvelles missions : <strong>{
    tier?.authorization_state==="active"?"Active":
    tier?.authorization_state==="suspended"?"Suspendue":"En attente de validation"
   }</strong></p>
   {count!==null&&<p className="mt-2 text-sm">{count} intervention{count!==1?"s":""} terminée{count!==1?"s":""}.
    Palier indicatif correspondant : {tierName(indicativeLevelForMissions(count))}.</p>}
   <p className="mt-2 text-sm text-muted-foreground">Les seuils (50, 150, 300 interventions) sont indicatifs : aucune promotion n'est automatique. Une évaluation réelle des compétences, de la qualité et de la satisfaction est nécessaire. Un profil sans SIRET peut se former mais ne peut pas intervenir contre rémunération.</p>
  </>}
 </section>;
}
