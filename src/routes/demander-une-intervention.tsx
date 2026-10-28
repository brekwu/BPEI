import {createFileRoute,Link} from "@tanstack/react-router";
import {PublicShell} from "@/components/public/PublicShell";
export const Route=createFileRoute("/demander-une-intervention")({
 head:()=>({meta:[{title:"Demander une intervention — BPEI"},{name:"robots",content:"noindex"}]}),
 component:()=> <PublicShell><section className="mx-auto max-w-3xl px-4 py-16">
 <h1 className="text-3xl font-bold">Interventions informatiques</h1>
 <p className="mt-5 text-muted-foreground">Le service de demande d'intervention est en préparation. Nous ne collectons ni demandes ni coordonnées clients sur cette page pour le moment.</p>
 <Link to="/" className="mt-6 inline-block underline">Retour à l'accueil</Link>
 </section></PublicShell>
});
