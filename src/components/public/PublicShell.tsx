import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { SITE } from "@/lib/site-content";
import type { ReactNode } from "react";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro?: string;
  sections: Array<{ id: string; title: string; body: ReactNode }>;
}) {
  return (
    <PublicShell>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[220px_1fr] md:px-6">
        <aside className="hidden md:block">
          <div className="sticky top-24 rounded-xl border border-border bg-card p-4 text-sm">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sommaire</div>
            <ul className="space-y-1.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">{s.title}</a>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => typeof window !== "undefined" && window.print()}
              className="mt-4 w-full rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
            >
              Imprimer
            </button>
          </div>
        </aside>
        <article className="prose prose-slate mx-auto max-w-none">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dernière mise à jour : {SITE.legalUpdatedAt}. Version 1.0.
          </p>
          {intro && <p className="mt-4 text-base text-foreground/90">{intro}</p>}
          <div className="mt-8 space-y-10">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24">
                <h2 className="text-xl font-semibold text-foreground">{s.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/85">{s.body}</div>
              </section>
            ))}
          </div>
          <div className="mt-10 flex justify-end">
            <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs text-muted-foreground hover:text-foreground">↑ Retour en haut</a>
          </div>
        </article>
      </div>
    </PublicShell>
  );
}