import {createFileRoute,Link} from "@tanstack/react-router";
import {PublicShell} from "@/components/public/PublicShell";
export const Route=createFileRoute("/connexion-paiement/retour")({
 component:ReturnFromConnect,
 head:()=>({meta:[{title:"Retour Stripe Connect — BPEI"},{name:"robots",content:"noindex,nofollow"}]})
});
function ReturnFromConnect(){
 return <PublicShell><main className="mx-auto max-w-2xl px-4 py-20">
  <h1 className="text-3xl font-bold">Retour de Stripe Connect</h1>
  <p className="mt-4">Le retour depuis Stripe ne confirme pas encore le contrôle d'identité ni l'activation des encaissements. Le statut réel est vérifié côté serveur et BPEI doit valider la liaison.</p>
  <p className="mt-3">Mode de préproduction uniquement. Aucun règlement réel n'est activé.</p>
  <Link to="/espace-independant" className="mt-6 inline-block underline">Revenir à mon espace et vérifier mon statut</Link>
 </main></PublicShell>;
}
