import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-electric px-4 py-2 text-sm font-medium text-electric-foreground transition-colors hover:bg-electric/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Cette page n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur inattendue est survenue. Réessayez ou revenez à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-electric px-4 py-2 text-sm font-medium text-electric-foreground transition-colors hover:bg-electric/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

import { getPublicSeoSnapshotFn } from "@/lib/platform-public.functions";

// Repli technique sobre — jamais marketing, jamais juridique, jamais inventé.
const FALLBACK_TITLE = "BPEI — Boutiques Professionnelles d'Experts Informatiques";
const FALLBACK_DESCRIPTION =
  "BPEI constitue un réseau de techniciens informatiques indépendants en France. Demandez une intervention ou candidatez comme partenaire freelance.";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async ({ context }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["public-seo-snapshot"],
      queryFn: () => getPublicSeoSnapshotFn(),
      staleTime: 60_000,
    }),
  head: ({ loaderData }) => {
    const snap = (loaderData ?? {}) as Partial<Awaited<ReturnType<typeof getPublicSeoSnapshotFn>>>;
    const title = snap.seoTitle ?? (snap.commercialName ? `${snap.commercialName} — Réseau BPEI` : FALLBACK_TITLE);
    const description = snap.seoDescription ?? FALLBACK_DESCRIPTION;
    const siteName = snap.commercialName ?? "BPEI";
    const meta: Array<Record<string, string>> = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { name: "application-name", content: siteName },
      { property: "og:site_name", content: siteName },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    // og:image / twitter:image uniquement si une image sociale publiée existe.
    if (snap.socialImage) {
      meta.push({ property: "og:image", content: snap.socialImage });
      meta.push({ name: "twitter:image", content: snap.socialImage });
    }
    const links: Array<Record<string, string>> = [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: snap.faviconUrl ?? "/favicon.ico", type: snap.faviconUrl ? "image/png" : "image/x-icon" },
    ];
    return { meta, links };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
      <CookieConsentBanner />
    </QueryClientProvider>
  );
}