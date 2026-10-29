import {createFileRoute,Link} from "@tanstack/react-router";
import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {PublicShell} from "@/components/public/PublicShell";
import {Button} from "@/components/ui/button";
import {formatCents} from "@/lib/bpei-commercial";
type Quote={
 id:string;status:string;created_at:string;issuer_legal_name:string;issuer_siret:string;
 issuer_address:string;issuer_email:string;customer_name:string;customer_email:string;
 customer_address:string;service_description:string;quantity:number;unit_price_cents:number;
 vat_basis_points:number;tax_mention:string;net_cents:number;vat_cents:number;gross_cents:number;
};
export const Route=createFileRoute("/devis/$quoteId")({
 component:QuoteView,
 head:()=>({meta:[{title:"Devis — BPEI"},{name:"robots",content:"noindex,nofollow"}]})
});
function QuoteView(){
 const {quoteId}=Route.useParams();
 const [quote,setQuote]=useState<Quote|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
  let active=true;
  setQuote(null);setLoading(true);setError("");
  (async()=>{
   const {data:user,error:authError}=await supabase.auth.getUser();
   if(authError||!user.user)throw new Error("Session required");
   const {data,error:e}=await (supabase as any).from("bpei_service_quotes")
    .select("id,status,created_at,issuer_legal_name,issuer_siret,issuer_address,issuer_email,customer_name,customer_email,customer_address,service_description,quantity,unit_price_cents,vat_basis_points,tax_mention,net_cents,vat_cents,gross_cents")
    .eq("id",quoteId).maybeSingle();
   if(e||!data)throw new Error("Quote unavailable");
   if(active)setQuote(data);
  })().catch(()=>{if(active){setError("Devis inaccessible ou session non autorisée.");setQuote(null);}})
   .finally(()=>{if(active)setLoading(false);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
   if(event==="SIGNED_OUT"&&active){setQuote(null);setError("Session terminée.");}
  });
  return ()=>{active=false;subscription.unsubscribe();};
 },[quoteId]);
 return <PublicShell><main className="mx-auto max-w-4xl px-4 py-10 print:m-0 print:p-0">
  <div className="mb-5 flex items-center justify-between print:hidden">
   <Link to="/gestion-commerciale" className="underline">Retour à la gestion commerciale</Link>
   <Button disabled={!quote} onClick={()=>window.print()}>Imprimer / Enregistrer en PDF</Button>
  </div>
  {loading&&<p role="status">Chargement du devis…</p>}{error&&<p role="alert">{error}</p>}
  {quote&&<article className="space-y-6 rounded border bg-white p-8 text-slate-950 print:rounded-none print:border-none print:p-0">
   <h1 className="text-3xl font-bold">DEVIS — {quote.status==="accepted"?"ACCEPTÉ":"PROPOSÉ"}</h1>
   <p>Référence : {quote.id} · Date : {new Date(quote.created_at).toLocaleDateString("fr-FR")}</p>
   <div className="grid gap-6 sm:grid-cols-2">
    <section><h2 className="font-semibold">Prestataire indépendant</h2><p>{quote.issuer_legal_name}</p><p className="whitespace-pre-wrap">{quote.issuer_address}</p><p>SIRET : {quote.issuer_siret}</p><p>{quote.issuer_email}</p></section>
    <section><h2 className="font-semibold">Client</h2><p>{quote.customer_name}</p><p className="whitespace-pre-wrap">{quote.customer_address}</p><p>{quote.customer_email}</p></section>
   </div>
   <table className="w-full border-collapse text-sm"><thead><tr className="border-b"><th className="py-2 text-left">Description</th><th className="text-right">Qté</th><th className="text-right">PU HT</th><th className="text-right">Total HT</th></tr></thead>
    <tbody><tr className="border-b"><td className="py-3">{quote.service_description}</td><td className="text-right">{quote.quantity}</td><td className="text-right">{formatCents(quote.unit_price_cents)}</td><td className="text-right">{formatCents(quote.net_cents)}</td></tr></tbody></table>
   <div className="ml-auto max-w-xs space-y-2 text-right">
    <p>Total HT : {formatCents(quote.net_cents)}</p><p>TVA ({quote.vat_basis_points/100} %) : {formatCents(quote.vat_cents)}</p>
    <p className="border-t pt-2 text-lg font-bold">Total TTC : {formatCents(quote.gross_cents)}</p>
   </div>
   {quote.tax_mention&&<p>Mention de TVA : {quote.tax_mention}</p>}
   <div className="border-t pt-3 text-sm"><p>Document de devis. Toute modification de prestation ou de prix nécessite un nouvel accord du client.</p>
    <p className="mt-2 font-semibold">Proposition établie en préproduction : mentions légales, prix et régime de TVA à valider avant transmission commerciale.</p>
   </div>
  </article>}
 </main></PublicShell>;
}
