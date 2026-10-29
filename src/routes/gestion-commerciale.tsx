import {createFileRoute,Link} from "@tanstack/react-router";
import {useBpeiAdminAccess} from "@/lib/use-bpei-admin-access";
import {PublicShell} from "@/components/public/PublicShell";
import {AdminCommercialDesk} from "@/components/admin/AdminCommercialDesk";
import {AdminConnectPanel} from "@/components/admin/AdminConnectPanel";
import {AdminPartnerCompensationDesk} from "@/components/admin/AdminPartnerCompensationDesk";
export const Route=createFileRoute("/gestion-commerciale")({
 component:CommercialManagement,
 head:()=>({meta:[{title:"Devis et factures — BPEI"},{name:"robots",content:"noindex,nofollow"}]})
});
function CommercialManagement(){
 const access=useBpeiAdminAccess();
 return <PublicShell><main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
  <h1 className="text-3xl font-bold">Gestion commerciale des interventions</h1>
  <p className="mt-2 text-sm text-muted-foreground">Accès administrateur. Devis, validation et factures des prestataires. Aucune transaction réelle n'est activée.</p>
  <Link to="/gestion-independants" className="mt-3 inline-block text-sm underline">Retour à l'administration</Link>
  {access==="loading"?<p role="status" className="mt-8">Vérification des droits…</p>:
   access==="denied"?<p role="alert" className="mt-8">Accès administrateur non autorisé.</p>:
   <><AdminConnectPanel/><AdminPartnerCompensationDesk/><AdminCommercialDesk/></>}
 </main></PublicShell>;
}
