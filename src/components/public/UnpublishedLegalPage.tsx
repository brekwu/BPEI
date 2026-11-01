import {Link} from "@tanstack/react-router";
import {PublicShell} from "@/components/public/PublicShell";
export function UnpublishedLegalPage({title}:{title:string}){
 return <PublicShell><section className="mx-auto max-w-3xl px-4 py-16">
 <h1 className="text-3xl font-bold">{title}</h1>
 <p className="mt-5 text-muted-foreground">Ce document n'est pas encore publié et validé pour le nouveau réseau BPEI. Aucun ancien contrat réservé aux boutiques ne s'applique automatiquement aux indépendants.</p>
 <Link to="/" className="mt-6 inline-block underline">Retour à l'accueil</Link>
 </section></PublicShell>;
}
