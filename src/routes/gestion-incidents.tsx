import {createFileRoute,Link} from "@tanstack/react-router";
import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {PublicShell} from "@/components/public/PublicShell";
import {AdminIncidentEscalations} from "@/components/admin/AdminIncidentEscalations";
import {BpeiInbox} from "@/components/shared/BpeiInbox";
export const Route=createFileRoute("/gestion-incidents")({
 component:IncidentManagement,
 head:()=>({meta:[{title:"Suivi des incidents — BPEI"},{name:"robots",content:"noindex,nofollow"}]})
});
function IncidentManagement(){
 const [access,setAccess]=useState<"loading"|"allowed"|"denied">("loading");
 useEffect(()=>{
  let active=true;
  (async()=>{
   const {data}=await supabase.auth.getUser();
   if(!data.user){if(active)setAccess("denied");return;}
   const {data:role,error}=await (supabase as any).from("independent_admins")
    .select("user_id").eq("user_id",data.user.id).maybeSingle();
   if(active)setAccess(!error&&role?"allowed":"denied");
  })().catch(()=>{if(active)setAccess("denied")});
  return ()=>{active=false};
 },[]);
 return <PublicShell><main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
  <h1 className="text-3xl font-bold">Suivi des incidents BPEI</h1>
  <p className="mt-2 text-sm text-muted-foreground">Accès réservé à l'administration. Les incidents ne sont pas visibles publiquement.</p>
  <Link to="/gestion-independants" className="mt-3 inline-block text-sm underline">Revenir à l'administration</Link>
  {access==="loading"?<p role="status" className="mt-8">Vérification de l'accès…</p>:
   access==="denied"?<p role="alert" className="mt-8">Accès administrateur non autorisé.</p>:
   <div className="mt-8 space-y-4"><BpeiInbox/><AdminIncidentEscalations/></div>}
 </main></PublicShell>;
}
