import {createFileRoute,Link} from "@tanstack/react-router";
import {PublicShell} from "@/components/public/PublicShell";
export const Route=createFileRoute("/contact")({
 head:()=>({meta:[{title:"Contact — BPEI"},{name:"robots",content:"noindex"}]}),
 component:()=> <PublicShell><section className="mx-auto max-w-3xl px-4 py-16">
 <h1 className="text-3xl font-bold">Contacter BPEI</h1>
 <p className="mt-5 text-muted-foreground">Le formulaire de contact est temporairement fermé pendant la préparation du nouveau réseau. Aucune demande ni coordonnée n'est enregistrée sur cette page.</p>
 <p className="mt-5">Vous êtes technicien indépendant ? <Link to="/devenir-partenaire" className="underline">Rejoindre le réseau</Link>.</p>
 </section></PublicShell>
});
