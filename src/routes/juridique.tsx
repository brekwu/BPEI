import {createFileRoute,Link} from "@tanstack/react-router";
import {PublicShell} from "@/components/public/PublicShell";
export const Route=createFileRoute("/juridique")({
 head:()=>({meta:[{title:"Informations juridiques — BPEI"},{name:"robots",content:"noindex"}]}),
 component:()=> <PublicShell><section className="mx-auto max-w-3xl px-4 py-16">
 <h1 className="text-3xl font-bold">Informations juridiques</h1>
 <p className="mt-4">Les documents applicables au nouveau réseau d'indépendants sont en cours de validation.</p>
 <nav className="mt-5 flex flex-col gap-2"><Link to="/mentions-legales" className="underline">Mentions légales</Link><Link to="/confidentialite" className="underline">Confidentialité</Link><Link to="/cgu" className="underline">CGU</Link><Link to="/cookies" className="underline">Cookies</Link></nav>
 </section></PublicShell>
});
