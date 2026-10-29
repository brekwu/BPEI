import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BPEILogo } from "./BPEILogo";
import { SITE } from "@/lib/site-content";

const NAV = [
  { to: "/", label: "Accueil" },
  { to: "/demander-une-intervention", label: "Demander une intervention" },
  { to: "/devenir-partenaire", label: "Devenir partenaire" },
  { to: "/comment-ca-marche", label: "Comment ça marche" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/" aria-label="BPEI, accueil" onClick={() => setOpen(false)}><BPEILogo variant="dark" /></Link>
        <nav aria-label="Navigation principale" className="hidden items-center gap-6 lg:flex">
          {NAV.map(item => <Link key={item.to} to={item.to} className="text-sm font-medium text-muted-foreground hover:text-foreground">{item.label}</Link>)}
        </nav>
        <Link to="/espace-independant" className="hidden rounded-md bg-electric px-4 py-2 text-sm font-semibold text-electric-foreground hover:opacity-90 lg:inline-flex">
          Espace indépendant
        </Link>
        <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md border lg:hidden" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="bpei-mobile-menu" onClick={() => setOpen(v => !v)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && <nav id="bpei-mobile-menu" aria-label="Navigation mobile" className="border-t bg-background px-4 py-3 lg:hidden">
        {[...NAV, { to: "/espace-independant" as const, label: "Espace indépendant" }].map(item => (
          <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm font-medium hover:bg-muted">{item.label}</Link>
        ))}
      </nav>}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-3 md:px-6">
        <div>
          <BPEILogo variant="light" />
          <p className="mt-4 text-sm text-white/75">{SITE.tagline}</p>
          <p className="mt-2 text-xs text-white/60">Réseau en constitution. Aucune disponibilité ni mission n'est garantie.</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Le réseau</h2>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            <li><Link to="/devenir-partenaire">Devenir partenaire indépendant</Link></li>
            <li><Link to="/espace-independant">Espace indépendant</Link></li>
            <li><Link to="/demander-une-intervention">Demander une intervention</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Informations et droits</h2>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            <li><Link to="/mentions-legales">Mentions légales</Link></li>
            <li><Link to="/confidentialite">Confidentialité</Link></li>
            <li><Link to="/cgu">Conditions d'utilisation</Link></li>
            <li><Link to="/cookies">Cookies</Link></li>
            <li><Link to="/demande-donnees">Droits sur les données</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15 px-4 py-5 text-center text-xs text-white/60">© {new Date().getFullYear()} {SITE.name} — Techniciens informatiques indépendants</div>
    </footer>
  );
}
