import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";
import { BpeiIntakeForm } from "@/components/public/BpeiIntakeForm";
export const Route = createFileRoute("/contact")({
 head:()=>({meta:[{title:"Contacter BPEI — BPEI"},{name:"robots",content:"noindex"}]}),
 component:()=> <PublicShell><section className="mx-auto max-w-3xl px-4 py-16">
   <h1 className="text-3xl font-bold">Contacter BPEI</h1>
   <p className="mt-4 text-muted-foreground">Posez une question à l'équipe BPEI. Le formulaire n'accepte des données que lorsque sa collecte est activée.</p>
   <BpeiIntakeForm kind="contact" />
 </section></PublicShell>
});
