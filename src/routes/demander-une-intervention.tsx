import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";
import { BpeiIntakeForm } from "@/components/public/BpeiIntakeForm";
export const Route = createFileRoute("/demander-une-intervention")({
 head:()=>({meta:[{title:"Demander une intervention informatique — BPEI"},{name:"robots",content:"noindex"}]}),
 component:()=> <PublicShell><section className="mx-auto max-w-3xl px-4 py-16">
   <h1 className="text-3xl font-bold">Demander une intervention informatique</h1>
   <p className="mt-4 text-muted-foreground">Décrivez votre besoin. Une demande ne garantit pas la disponibilité d'un technicien indépendant.</p>
   <BpeiIntakeForm kind="intervention" />
 </section></PublicShell>
});
