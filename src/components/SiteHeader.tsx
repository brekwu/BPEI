import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BPEILogo } from "./BPEILogo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/useSession";
import { Menu, X, MapPin, Phone, Mail } from "lucide-react";
import { SITE } from "@/lib/site-content";
import { usePlatformSettings } from "@/lib/platform-settings";
import { SpaceSwitcher } from "./SpaceSwitcher";

const NAV = [
  { to: "/", label: "Accueil" },
  { to: "/boutiques", label: "Trouver une boutique" },
  { to: "/catalogue", label: "Catalogue" },
  { to: "/professionnels", label: "Pour les professionnels" },
  { to: "/tarifs", label: "Tarifs" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const { session, loading } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/" className="flex items-center" onClick={() => setOpen(false)}>
          <BPEILogo variant="dark" />
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {loading ? (
            <div aria-hidden className="h-9 w-40 rounded-md bg-muted/40" />
          ) : session ? (
            <SpaceSwitcher />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/auth">Se connecter</Link></Button>
              <Button asChild size="sm" className="bg-electric text-electric-foreground hover:bg-electric/90">
                <Link to="/boutiques">Trouver une boutique</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border lg:hidden"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 top-16 z-40 border-t border-border bg-background shadow-lg lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <nav aria-label="Navigation mobile" className="flex flex-col p-4">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-secondary"
                activeProps={{ className: "bg-secondary text-electric" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3">
              {session ? (
                <Button asChild className="col-span-2" onClick={() => setOpen(false)}>
                  <Link to="/app">Mon espace</Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" onClick={() => setOpen(false)}>
                    <Link to="/auth">Se connecter</Link>
                  </Button>
                  <Button asChild className="bg-electric text-electric-foreground hover:bg-electric/90" onClick={() => setOpen(false)}>
                    <Link to="/boutiques">Trouver une boutique</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { settings } = usePlatformSettings();
  const contactEmail = settings.contact.email;
  const contactPhone = settings.contact.phone;
  const contactAddress = settings.contact.address;
  const socialEntries = Object.entries(settings.social).filter(([, v]) => !!v) as Array<[string, string]>;
  return (
    <footer className="border-t border-border/60 bg-navy text-navy-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <BPEILogo variant="light" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              {settings.identity.tagline ?? SITE.tagline} Des outils professionnels, une identité commune,
              un service de proximité.
            </p>
            <ul className="mt-5 space-y-2 text-xs text-white/60">
              {contactEmail && (
                <li className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  <a href={`mailto:${contactEmail}`} className="hover:text-white">{contactEmail}</a>
                </li>
              )}
              {contactPhone && (
                <li className="inline-flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  <a href={`tel:${contactPhone}`} className="hover:text-white">{contactPhone}</a>
                </li>
              )}
              {contactAddress && (
                <li className="inline-flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{contactAddress}</span>
                </li>
              )}
            </ul>
            {socialEntries.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-3 text-xs text-white/70">
                {socialEntries.map(([k, url]) => (
                  <li key={k}>
                    <a href={url} target="_blank" rel="noreferrer" className="capitalize hover:text-white">{k}</a>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">
                Bêta en cours
              </span>
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/80">
                Entreprise française
              </span>
              <Link to="/confidentialite" className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:bg-white/10">
                Politique de confidentialité
              </Link>
            </div>

          </div>


          <div className="grid gap-8 md:col-span-8 md:grid-cols-4">
            <FooterCol title="Particuliers">
              <FooterLink to="/boutiques">Trouver une boutique</FooterLink>
              <FooterLink to="/catalogue">Catalogue</FooterLink>
              <FooterLink to="/annuaire">Annuaire vérifié</FooterLink>
              <FooterLink to="/avis/politique">Politique des avis</FooterLink>
            </FooterCol>
            <FooterCol title="Professionnels">
              <FooterLink to="/professionnels">Rejoindre BPEI</FooterLink>
              <FooterLink to="/tarifs">Tarifs détaillés</FooterLink>
              <FooterLink to="/rejoindre">Candidater</FooterLink>
              <FooterLink to="/vendeurs/regles">Règles vendeurs</FooterLink>
              <FooterLink to="/auth">Connexion boutique</FooterLink>
            </FooterCol>
            <FooterCol title="Ressources">
              <FooterLink to="/juridique">Centre juridique</FooterLink>
              <FooterLink to="/conditions-abonnement">Conditions d'abonnement</FooterLink>
              <FooterLink to="/conditions-beta">Conditions bêta</FooterLink>
              <FooterLink to="/annuaire/regles-admission">Règles d'admission</FooterLink>
              <FooterLink to="/annuaire/badge-verifie">Badge vérifié</FooterLink>
            </FooterCol>
            <FooterCol title="Assistance">
              <FooterLink to="/contact">Nous contacter</FooterLink>
              <FooterLink to="/reclamations">Réclamations & médiation</FooterLink>
              <FooterLink to="/signalement">Signalement DSA</FooterLink>
              <FooterLink to="/suspension-recours">Recours suspension</FooterLink>
              <FooterLink to="/signaler-bug">Signaler un bug</FooterLink>
              <FooterLink to="/demande-donnees">Mes données (RGPD)</FooterLink>
            </FooterCol>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-white/50 md:flex-row md:items-center md:justify-between md:px-6">
          <div>© {new Date().getFullYear()} {SITE.name} — {SITE.fullName}.</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <li><Link to="/mentions-legales" className="hover:text-white">Mentions légales</Link></li>
            <li><Link to="/confidentialite" className="hover:text-white">Confidentialité</Link></li>
            <li><Link to="/cgu" className="hover:text-white">CGU</Link></li>
            <li><Link to="/cgv" className="hover:text-white">CGV / CGS</Link></li>
            <li><Link to="/cookies" className="hover:text-white">Cookies</Link></li>
            <li><Link to="/pay/politique" className="hover:text-white">Politique paiements</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">{title}</h4>
      <ul className="space-y-2 text-sm text-white/80">{children}</ul>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <li><Link to={to} className="hover:text-white">{children}</Link></li>;
}