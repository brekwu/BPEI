import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
export const Route = createRootRouteWithContext<{queryClient:QueryClient}>()({
 head: () => ({
  meta: [
   {charSet:"utf-8"}, {name:"viewport", content:"width=device-width, initial-scale=1"},
   {title:"BPEI — Techniciens informatiques indépendants"},
   {name:"description",content:"BPEI construit un réseau de techniciens informatiques indépendants. Rejoignez le réseau."},
   {name:"application-name",content:"BPEI"}
  ],
  links:[{rel:"stylesheet",href:appCss},{rel:"icon",href:"/favicon.svg",type:"image/svg+xml"}]
 }),
 shellComponent: RootShell,
 component: RootComponent,
 notFoundComponent: () => <div className="mx-auto max-w-lg px-5 py-20"><h1 className="text-3xl font-bold">Page introuvable</h1><p className="my-4">Cette page n'est plus disponible.</p><Link to="/" className="underline">Retour à l'accueil</Link></div>,
 errorComponent: () => <div className="mx-auto max-w-lg px-5 py-20"><h1 className="text-xl font-bold">Page momentanément indisponible</h1><Link to="/" className="mt-4 inline-block underline">Retour à l'accueil</Link></div>,
});
function RootShell({children}:{children:ReactNode}) {return <html lang="fr"><head><HeadContent/></head><body>{children}<Scripts/></body></html>}
function RootComponent(){const {queryClient}=Route.useRouteContext();return <QueryClientProvider client={queryClient}><Outlet/><Toaster richColors position="top-right"/></QueryClientProvider>}
