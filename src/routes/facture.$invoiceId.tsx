import {createFileRoute,Link} from "@tanstack/react-router";
import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {PublicShell} from "@/components/public/PublicShell";
import {Button} from "@/components/ui/button";
import {formatCents} from "@/lib/bpei-commercial";

type Invoice={id:string;invoice_number:string;quote_id:string;issued_at:string;service_date:string;due_date:string;payment_status:string};
type Quote={id:string;issuer_legal_name:string;issuer_siret:string;issuer_address:string;issuer_email:string;
 tax_mention:string;customer_name:string;customer_email:string;customer_address:string;customer_kind:string;customer_siret:string|null;
 service_description:string;quantity:number;unit_price_cents:number;vat_basis_points:number;net_cents:number;vat_cents:number;gross_cents:number;accepted_at:string|null};
export const Route=createFileRoute("/facture/$invoiceId")({
 component:InvoiceView,
 head:()=>({meta:[{title:"Facture — BPEI"},{name:"robots",content:"noindex,nofollow"}]})
});
function InvoiceView(){
 const {invoiceId}=Route.useParams();
 const [invoice,setInvoice]=useState<Invoice|null>(null);
 const [quote,setQuote]=useState<Quote|null>(null);
 const [testPaymentConfirmed,setTestPaymentConfirmed]=useState(false);
 const [testRefundedCents,setTestRefundedCents]=useState(0);
 const [testDisputeStatus,setTestDisputeStatus]=useState<"open"|"won"|"lost"|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  setLoading(true);setInvoice(null);setQuote(null);setTestPaymentConfirmed(false);setTestRefundedCents(0);setTestDisputeStatus(null);setError("");
  (async()=>{
   const db=supabase as any;
   const {data:session,error:authError}=await supabase.auth.getUser();
   if(authError||!session.user)throw new Error("No session");
   const {data:i,error:e}=await db.from("bpei_service_invoices")
    .select("id,invoice_number,quote_id,issued_at,service_date,due_date,payment_status")
    .eq("id",invoiceId).maybeSingle();
   if(e||!i)throw new Error("Invoice not available");
   const {data:q,error:quoteError}=await db.from("bpei_service_quotes")
    .select("id,issuer_legal_name,issuer_siret,issuer_address,issuer_email,tax_mention,customer_name,customer_email,customer_address,customer_kind,customer_siret,service_description,quantity,unit_price_cents,vat_basis_points,net_cents,vat_cents,gross_cents,accepted_at")
    .eq("id",i.quote_id).maybeSingle();
   if(quoteError||!q)throw new Error("Quote not available");
   const {data:verified,error:paymentError}=await db.from("bpei_payment_attempts")
    .select("id,state,amount_cents").eq("invoice_id",i.id).eq("state","paid").limit(1);
   if(paymentError)throw new Error("Payment status unavailable");
   let refunded=0;let dispute:"open"|"won"|"lost"|null=null;
   if(verified?.[0]){
    const [refundResponse,disputeResponse]=await Promise.all([
     db.from("bpei_payment_refunds").select("amount_cents,status").eq("attempt_id",verified[0].id),
     db.from("bpei_payment_disputes").select("status").eq("attempt_id",verified[0].id)
    ]);
    if(refundResponse.error||disputeResponse.error)throw new Error("Payment adjustments unavailable");
    refunded=(refundResponse.data??[]).filter((r:{status:string})=>r.status==="succeeded")
      .reduce((total:number,r:{amount_cents:number})=>total+r.amount_cents,0);
    const statuses=(disputeResponse.data??[]) as {status:"open"|"won"|"lost"}[];
    dispute=statuses.some(d=>d.status==="open")?"open":
      statuses.some(d=>d.status==="lost")?"lost":
      statuses.some(d=>d.status==="won")?"won":null;
   }
   if(active){setInvoice(i);setQuote(q);setTestPaymentConfirmed((verified??[]).length>0);
    setTestRefundedCents(refunded);setTestDisputeStatus(dispute);}
  })().catch(()=>{if(active){setInvoice(null);setQuote(null);setTestPaymentConfirmed(false);setTestRefundedCents(0);setTestDisputeStatus(null);setError("Facture indisponible ou accès non autorisé.");}})
   .finally(()=>{if(active)setLoading(false)});
  const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
   if(event==="SIGNED_OUT"&&active){setInvoice(null);setQuote(null);setTestPaymentConfirmed(false);setTestRefundedCents(0);setTestDisputeStatus(null);setError("Session terminée.");}
  });
  return ()=>{active=false;subscription.unsubscribe();};
 },[invoiceId]);
 const date=(value:string)=>new Date(value).toLocaleDateString("fr-FR");
 return <PublicShell><main className="mx-auto max-w-4xl px-4 py-10 print:m-0 print:max-w-none print:p-0">
  <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
   <Link to="/gestion-commerciale" className="text-sm underline">Retour aux devis et factures</Link>
   <Button type="button" disabled={!invoice||!quote} onClick={()=>window.print()}>Imprimer / Enregistrer en PDF</Button>
  </div>
  {loading&&<p role="status">Vérification de la facture…</p>}
  {error&&<p role="alert">{error}</p>}
  {invoice&&quote&&<article id="bpei-invoice-print" className="space-y-7 rounded border bg-white p-8 text-slate-950 shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none" aria-label="Facture">
   <p className="border border-amber-700 p-2 text-center text-sm font-bold">DOCUMENT DE PRÉPRODUCTION — À VÉRIFIER AVANT ÉMISSION RÉELLE</p>
   <header className="flex flex-wrap items-start justify-between gap-8 border-b pb-5">
    <div><p className="text-xs font-semibold uppercase tracking-wide">Facture du prestataire indépendant</p>
     <h1 className="mt-2 text-3xl font-bold">FACTURE</h1>
     <p className="mt-1 text-lg font-semibold">N° {invoice.invoice_number}</p>
     <p>Émise le {date(invoice.issued_at)}</p>
     <p>Prestation réalisée le {date(invoice.service_date)}</p>
    </div>
    <div><h2 className="font-semibold">Prestataire / Émetteur</h2>
     <p className="whitespace-pre-wrap">{quote.issuer_legal_name}</p>
     <p className="whitespace-pre-wrap">{quote.issuer_address}</p>
     <p>SIRET : {quote.issuer_siret}</p><p>{quote.issuer_email}</p>
    </div>
   </header>
   <section><h2 className="mb-2 font-semibold">Facturé à</h2>
    <p>{quote.customer_name}</p><p className="whitespace-pre-wrap">{quote.customer_address}</p>
    {quote.customer_kind==="business"&&quote.customer_siret&&<p>SIRET : {quote.customer_siret}</p>}
    <p>{quote.customer_email}</p>
   </section>
   <section>
    <table className="w-full border-collapse text-sm">
     <thead><tr className="border-b text-left"><th className="py-3">Prestation</th><th className="py-3 text-right">Qté</th><th className="py-3 text-right">PU HT</th><th className="py-3 text-right">HT</th></tr></thead>
     <tbody><tr className="border-b"><td className="py-4">{quote.service_description}</td><td className="py-4 text-right">{quote.quantity}</td><td className="py-4 text-right">{formatCents(quote.unit_price_cents)}</td><td className="py-4 text-right">{formatCents(quote.net_cents)}</td></tr></tbody>
    </table>
    <div className="mt-5 ml-auto max-w-xs space-y-2">
     <p className="flex justify-between"><span>Total HT</span><strong>{formatCents(quote.net_cents)}</strong></p>
     <p className="flex justify-between"><span>TVA ({(quote.vat_basis_points/100).toLocaleString("fr-FR")} %)</span><strong>{formatCents(quote.vat_cents)}</strong></p>
     <p className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total TTC</span><span>{formatCents(quote.gross_cents)}</span></p>
    </div>
    {quote.tax_mention&&<p className="mt-4 text-sm">Mention fiscale : {quote.tax_mention}</p>}
   </section>
   <footer className="space-y-2 border-t pt-5 text-sm">
    <p>Échéance de paiement : <strong>{date(invoice.due_date)}</strong></p>
    <p>État du paiement : <strong>{!testPaymentConfirmed?"Non confirmé / impayé":
     testDisputeStatus==="open"?"CONTESTATION EN COURS (Stripe TEST)":
     testDisputeStatus==="lost"?"CONTESTATION PERDUE (Stripe TEST)":
     testRefundedCents>=quote.gross_cents?"REMBOURSEMENT TOTAL (Stripe TEST)":
     testRefundedCents>0?"REMBOURSEMENT PARTIEL (Stripe TEST)":
     "PAIEMENT SIMULÉ CONFIRMÉ (Stripe TEST)"}</strong>. Aucun paiement TEST ne vaut encaissement réel ; rapprocher les fonds chez le prestataire avant tout reçu définitif.</p>
    {testRefundedCents>0&&<p>Montant remboursé confirmé en environnement TEST : {formatCents(testRefundedCents)}. Un éventuel avoir comptable est à établir par le prestataire après validation.</p>}
    {testDisputeStatus==="open"&&<p>Contestation bancaire en cours : consulter Stripe et ne pas considérer les fonds comme définitifs.</p>}
    <p>Devis accepté le {quote.accepted_at?date(quote.accepted_at):"non renseigné"} · Référence du devis : {quote.id}</p>
    {quote.customer_kind==="business"&&<p>Conditions de pénalités de retard et éventuelle indemnité forfaitaire de recouvrement : à préciser par le prestataire selon ses conditions contractuelles.</p>}
   </footer>
   <p className="text-xs print:hidden">Document interne de préproduction : identité, mentions obligatoires et régime de TVA à vérifier avant tout usage commercial. Ce PDF imprimé n'est pas une facture électronique structurée.</p>
  </article>}
 </main></PublicShell>;
}
