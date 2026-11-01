import { Link } from "@tanstack/react-router";
import { BPEILogo } from "./BPEILogo";
const nav = [
{to:"/", label:"Accueil"},
{to:"/devenir-partenaire",label:"Devenir partenaire"},
{to:"/comment-ca-marche",label:"Comment ça marche"},
{to:"/espace-independant",label:"Espace indépendant"},
{to:"/contact",label:"Contact"},
] as const;
export function SiteHeader() {
return <header className="border-b bg-background"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-4 py-4">
<Link to="/" aria-label="BPEI — accueil"><BPEILogo /></Link>
<nav aria-label="Navigation principale" className="flex flex-wrap items-center gap-4">{nav.map(x=><Link key={x.to} to={x.to} className="text-sm font-medium hover:underline">{x.label}</Link>)}</nav>
</div></header>;
}
export function SiteFooter() {
return <footer className="mt-auto bg-navy text-white"><div className="mx-auto max-w-6xl px-4 py-10">
<p className="font-semibold">BPEI — Réseau de techniciens informatiques indépendants</p>
<p className="mt-2 text-sm text-white/70">Réseau en constitution. Aucune mission ou disponibilité n'est garantie.</p>
<nav aria-label="Informations" className="mt-5 flex flex-wrap gap-4 text-sm text-white/80">
<Link to="/devenir-partenaire">Partenaires</Link><Link to="/contact">Contact</Link><Link to="/mentions-legales">Mentions légales</Link><Link to="/confidentialite">Confidentialité</Link><Link to="/cgu">CGU</Link><Link to="/cookies">Cookies</Link>
</nav>
<p className="mt-6 text-xs text-white/60">© {new Date().getFullYear()} BPEI</p>
</div></footer>;
}
