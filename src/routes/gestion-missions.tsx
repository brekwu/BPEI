import {createFileRoute,Link} from "@tanstack/react-router";
import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {PublicShell} from "@/components/public/PublicShell";
import {AdminMissionBoardServer} from "@/components/admin/AdminMissionBoardServer";
export const Route=createFileRoute("/gestion-missions")({
 component:MissionManagement,
 head:()=>({meta:[{title:"Suivi des missions — BPEI"},{name:"robots",content:"noindex,nofollow"}]})
});
function MissionManagement(){
 const [access,setAccess]=useState<"loading"|"allowed"|"denied">("loading");
 useEffect(()=>{
  let active=true;
  (async()=>{
   const {data}=await supabase.auth.getUser();
   if(!data.user){if(active)setAccess("denied");return;}
   const {data:admin,error}=await (supabase as any).from("independent_admins")
      .select("user_id").eq("user_id",data.user.id).maybeSingle();
   if(active)setAccess(!error&&admin?"allowed":"denied");
  })().catch(()=>{if(active)setAccess("denied")});
  return ()=>{active=false};
 },[]);
 return <PublicShell><main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
  <h1 className="text-3xl font-bold">Gestion des missions BPEI</h1>
  <p className="mt-2 text-sm text-muted-foreground">Suivi et historique des interventions du réseau. Données réservées aux administrateurs autorisés.</p>
  <Link to="/gestion-independants" className="mt-3 inline-block text-sm underline">Revenir à l'administration</Link>
  {access==="loading"?<p className="mt-8" role="status">Vérification de l'accès…</p>:
   access==="denied"?<p className="mt-8" role="alert">Accès administrateur non autorisé.</p>:
   <div className="mt-8"><AdminMissionBoardServer/></div>}
 </main></PublicShell>;
}
