import {createFileRoute,Link} from "@tanstack/react-router";
import {PublicShell} from "@/components/public/PublicShell";
export const Route=createFileRoute("/paiement/retour")({
 head:()=>({meta:[{title:"Retour du paiement — BPEI"},{name:"robots",content:"noindex,nofollow"}]}),
 component:PaymentReturn
});
function PaymentReturn(){
 return <PublicShell><main className="mx-auto max-w-2xl px-4 py-20">
  <h1 className="text-3xl font-bold">Retour de Stripe Checkout</h1>
  <p className="mt-4">Le retour vers cette page <strong>ne prouve jamais qu'un paiement a été encaissé</strong>. Seule une confirmation vérifiée du prestataire, rapprochée de la facture, peut confirmer le paiement.</p>
  <p className="mt-3">BPEI utilise uniquement une intégration de test en préparation. Ne considérez aucune opération comme un règlement réel.</p>
  <Link to="/" className="mt-6 inline-block underline">Revenir à l'accueil</Link>
 </main></PublicShell>;
}
