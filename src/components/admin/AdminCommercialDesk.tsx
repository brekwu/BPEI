import {useCallback,useEffect,useState,type FormEvent} from "react";
import {Link} from "@tanstack/react-router";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {euroToCents,formatCents,vatChoices} from "@/lib/bpei-commercial";

type Inquiry={id:string;client_name:string;email:string;phone:string|null;address_line1:string|null;postal_code:string|null;city:string|null;
 subject:string;status:string;assigned_to:string|null;customer_kind:string};
type Quote={id:string;inquiry_id:string;issuer_id:string;status:string;issuer_legal_name:string;
 issuer_siret:string;customer_name:string;service_description:string;quantity:number;
 unit_price_cents:number;vat_basis_points:number;net_cents:number;vat_cents:number;gross_cents:number;
 accepted_at:string|null};
type Invoice={id:string;quote_id:string;invoice_number:string;issued_at:string;payment_status:string};
type Mission={inquiry_id:string;status:string};
type PaymentAttempt={invoice_id:string;state:string;paid_at:string|null;created_at:string};
const testCheckoutUI=import.meta.env.VITE_BPEI_TEST_CHECKOUT_ENABLED==="true";

export function AdminCommercialDesk(){
 const [inquiries,setInquiries]=useState<Inquiry[]>([]);
 const [quotes,setQuotes]=useState<Quote[]>([]);
 const [invoices,setInvoices]=useState<Invoice[]>([]);
 const [missions,setMissions]=useState<Mission[]>([]);
 const [payments,setPayments]=useState<PaymentAttempt[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [failure,setFailure]=useState("");
 const [inquiryId,setInquiryId]=useState("");
 const [issuerName,setIssuerName]=useState("");
 const [issuerAddress,setIssuerAddress]=useState("");
 const [issuerEmail,setIssuerEmail]=useState("");
 const [taxMention,setTaxMention]=useState("");
 const [description,setDescription]=useState("");
 const [price,setPrice]=useState("");
 const [quantity,setQuantity]=useState("1");
 const [vat,setVat]=useState("");
 const [evidenceMethod,setEvidenceMethod]=useState("email");
 const [evidenceReference,setEvidenceReference]=useState("");
 const [serviceDate,setServiceDate]=useState("");
 const [dueDate,setDueDate]=useState("");

 const refresh=useCallback(async()=>{
  setLoading(true);setFailure("");
  try{
   const db=supabase as any;
   const [i,q,n,m,pa]=await Promise.all([
    db.from("bpei_inquiries").select("id,client_name,email,phone,address_line1,postal_code,city,subject,status,assigned_to,customer_kind").eq("kind","intervention").order("created_at",{ascending:false}).limit(200),
    db.from("bpei_service_quotes").select("id,inquiry_id,issuer_id,status,issuer_legal_name,issuer_siret,customer_name,service_description,quantity,unit_price_cents,vat_basis_points,net_cents,vat_cents,gross_cents,accepted_at").order("created_at",{ascending:false}).limit(200),
    db.from("bpei_service_invoices").select("id,quote_id,invoice_number,issued_at,payment_status").order("issued_at",{ascending:false}).limit(200),
    db.from("independent_requests").select("inquiry_id,status").not("inquiry_id","is",null).limit(500),
    db.from("bpei_payment_attempts").select("invoice_id,state,paid_at,created_at").order("created_at",{ascending:false}).limit(500)
   ]);
   if(i.error||q.error||n.error||m.error||pa.error)throw new Error("Load failed");
   setInquiries(i.data??[]);setQuotes(q.data??[]);setInvoices(n.data??[]);setMissions(m.data??[]);setPayments(pa.data??[]);
  }catch{
   setInquiries([]);setQuotes([]);setInvoices([]);setMissions([]);setPayments([]);
   setFailure("Lecture de la gestion commerciale impossible. Vérifiez vos droits et recommencez.");
  }finally{setLoading(false);}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);

 const selected=inquiries.find(i=>i.id===inquiryId);
 const currentHasQuote=!!selected&&quotes.some(q=>q.inquiry_id===selected.id);
 const available=inquiries.filter(i=>i.status==="assigned"&&!quotes.some(q=>q.inquiry_id===i.id));
 const cents=euroToCents(price);
 const qty=Number(quantity);
 const isValidQty=Number.isInteger(qty)&&qty>=1&&qty<=100;
 const validVat=vatChoices.some(v=>v.basisPoints===Number(vat))&&vat!=="";
 const workDone=(id:string)=>missions.some(m=>m.inquiry_id===id&&m.status==="completed");

 async function run(task:()=>Promise<{error:unknown}|{error?:unknown}>,
  successMessage:string){
  if(busy)return;
  setBusy(true);setFailure("");setMessage("");
  try{
   const result=await task();
   if(result.error)throw new Error("Database action rejected");
   setMessage(successMessage);
   await refresh();
  }catch{setFailure("Opération refusée. Vérifiez le dossier, l'accord du client, les droits et les informations légales, puis actualisez.");}
  finally{setBusy(false);}
 }

 async function startTestCheckout(invoice:Invoice){
  if(!testCheckoutUI||busy)return;
  if(!window.confirm("Ouvrir un paiement fictif Stripe en environnement de test ? Aucun paiement réel n'est autorisé."))return;
  setBusy(true);setFailure("");
  try{
   const {data,error}=await supabase.functions.invoke("bpei-test-checkout",{body:{invoice_id:invoice.id}});
   if(error||!data||data.mode!=="test"||typeof data.url!=="string")
    throw new Error("No test checkout");
   const url=new URL(data.url);
   if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com")
    throw new Error("Invalid checkout destination");
   window.location.assign(url.href);
  }catch{
   setFailure("Paiement de test indisponible : compte indépendant, clés Stripe ou validation serveur manquants.");
   setBusy(false);
  }
 }
 function submitQuote(e:FormEvent){
  e.preventDefault();
  if(!selected||currentHasQuote||!cents||!isValidQty||!validVat)return;
  if(!window.confirm("Valider les coordonnées du prestataire, son régime TVA et le prix proposé ?"))return;
  void run(()=> (supabase as any).rpc("mvp_create_quote",{
    p_inquiry_id:selected.id,p_issuer_legal_name:issuerName.trim(),p_issuer_address:issuerAddress.trim(),
    p_issuer_email:issuerEmail.trim(),p_tax_mention:taxMention.trim(),
    p_service_description:description.trim(),p_quantity:qty,
    p_unit_price_cents:cents,p_vat_basis_points:Number(vat)
   }),"Devis enregistré. Transmettez-le au client par un canal sécurisé ; attendez une acceptation vérifiable.");
 }
 function accept(quote:Quote){
  if(evidenceReference.trim().length<10)return;
  if(!window.confirm("Avez-vous réellement obtenu et conservé la preuve de l'accord du client ?"))return;
  void run(()=> (supabase as any).rpc("mvp_accept_quote",{
   p_quote_id:quote.id,p_method:evidenceMethod,p_evidence_reference:evidenceReference.trim()
  }),"Acceptation du client enregistrée avec sa référence justificative.");
 }
 function issue(quote:Quote){
  if(!serviceDate||!dueDate)return;
  if(!window.confirm("Créer une facture définitive et numérotée pour ce prestataire ? Elle ne sera plus modifiable."))return;
  void run(()=> (supabase as any).rpc("mvp_issue_invoice",{
   p_quote_id:quote.id,p_service_date:serviceDate,p_due_date:dueDate
  }),"Facture définitive enregistrée. Vérifiez et imprimez-la depuis la liste ci-dessous.");
 }

 return <section className="mt-12 space-y-5" aria-label="Gestion commerciale BPEI">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <h2 className="text-xl font-semibold">Devis et factures — MVP</h2>
   <Button type="button" variant="outline" disabled={busy||loading} onClick={()=>void refresh()}>Actualiser</Button>
  </div>
  <p className="text-sm text-muted-foreground">Chaque prestataire reste l'émetteur de sa facture. Aucun paiement n'est marqué comme reçu sans intégration bancaire vérifiée. Le module ne produit pas de facture électronique structurée B2B.</p>
  {loading&&<p role="status">Chargement des dossiers commerciaux…</p>}
  {failure&&<p role="alert" className="text-sm text-destructive">{failure}</p>}
  {message&&<p role="status" className="text-sm">{message}</p>}
  {!loading&&<div className="space-y-6">
   <form onSubmit={submitQuote} className="space-y-4 rounded-lg border p-4">
    <h3 className="font-semibold">1. Préparer un devis</h3>
    <label className="block text-sm">Demande attribuée à un indépendant
     <select className="mt-1 w-full rounded border bg-background p-2" required value={inquiryId}
      onChange={e=>{setInquiryId(e.target.value);const i=inquiries.find(x=>x.id===e.target.value);setDescription(i?.subject??"");}}>
      <option value="">Choisir une intervention</option>
      {available.map(i=><option value={i.id} key={i.id}>{i.client_name} · {i.city} · {i.subject}</option>)}
     </select>
    </label>
    {selected&&<p className="text-sm">Client : {selected.client_name}, {selected.address_line1}, {selected.postal_code} {selected.city}. Téléphone : {selected.phone??"manquant"}.</p>}
    <div className="grid gap-3 md:grid-cols-2">
     <label className="text-sm">Nom légal du prestataire (EI si applicable) *<Input required minLength={5} maxLength={180} value={issuerName} onChange={e=>setIssuerName(e.target.value)}/></label>
     <label className="text-sm">E-mail professionnel du prestataire *<Input type="email" required value={issuerEmail} onChange={e=>setIssuerEmail(e.target.value)}/></label>
     <label className="text-sm md:col-span-2">Adresse professionnelle du prestataire *<Input required minLength={10} maxLength={300} value={issuerAddress} onChange={e=>setIssuerAddress(e.target.value)}/></label>
     <label className="text-sm md:col-span-2">Prestation facturée *<Input required minLength={10} maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
     <label className="text-sm">Prix unitaire HT en euros *<Input required inputMode="decimal" placeholder="90,00" value={price} onChange={e=>setPrice(e.target.value)}/></label>
     <label className="text-sm">Quantité *<Input required type="number" min={1} max={100} step={1} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
     <label className="text-sm">TVA applicable, à vérifier *<select required className="mt-1 w-full rounded border bg-background p-2" value={vat} onChange={e=>setVat(e.target.value)}>
      <option value="">Choisir le régime</option>{vatChoices.map(v=><option key={v.basisPoints} value={v.basisPoints}>{v.label}</option>)}
     </select></label>
     <label className="text-sm">Mention fiscale si TVA à 0 %<Input maxLength={200} placeholder="À justifier selon le statut du prestataire" value={taxMention} onChange={e=>setTaxMention(e.target.value)}/></label>
    </div>
    <Button type="submit" disabled={busy||!selected||currentHasQuote||!cents||!isValidQty||!validVat||(vat==="0"&&taxMention.trim().length<10)}>Créer le devis</Button>
    {selected&&currentHasQuote&&<p className="text-sm text-muted-foreground">Un devis existe déjà pour cette intervention (une version par intervention pour ce MVP).</p>}
   </form>

   <div className="space-y-3">
    <h3 className="font-semibold">2. Devis, acceptation et émission</h3>
    {!quotes.length&&<p className="text-sm text-muted-foreground">Aucun devis pour le moment.</p>}
    {quotes.map(q=>{
     const invoice=invoices.find(i=>i.quote_id===q.id);
     const source=inquiries.find(i=>i.id===q.inquiry_id);
     const completed=workDone(q.inquiry_id);
     return <article key={q.id} className="rounded-lg border p-4 space-y-3 text-sm">
      <p><strong>{q.customer_name}</strong> · {q.service_description}</p>
      <p>Prestataire : {q.issuer_legal_name} (SIRET {q.issuer_siret})</p>
      <p>Montant HT {formatCents(q.net_cents)} · TVA {formatCents(q.vat_cents)} · <strong>Total TTC {formatCents(q.gross_cents)}</strong></p>
      <p>Statut : {q.status==="accepted"?"Devis accepté":"Devis proposé"} · Mission {completed?"terminée":"non terminée"} · Paiement non confirmé</p>
      <Link to="/devis/$quoteId" params={{quoteId:q.id}} className="inline-block underline">Consulter et imprimer le devis</Link>
      {source&&<p className="text-muted-foreground">Dossier : {source.subject} · {source.email}</p>}
      {q.status==="proposed"&&<div className="space-y-2 border-t pt-3">
       <p>Après validation explicite du client, conservez une preuve vérifiable (e-mail ou document signé).</p>
       <label className="block">Mode de validation
        <select className="mt-1 rounded border bg-background p-2" value={evidenceMethod} onChange={e=>setEvidenceMethod(e.target.value)}>
         <option value="email">Accord par e-mail</option><option value="signed">Document signé</option>
        </select>
       </label>
       <label className="block">Référence de la preuve (10 caractères minimum)
        <Input value={evidenceReference} maxLength={300} onChange={e=>setEvidenceReference(e.target.value)} placeholder="Identifiant du courriel ou du document archivé"/>
       </label>
       <Button type="button" disabled={busy||evidenceReference.trim().length<10} onClick={()=>accept(q)}>Enregistrer l'acceptation</Button>
      </div>}
      {q.status==="accepted"&&!invoice&&<div className="space-y-2 border-t pt-3">
       <p>La facture définitive peut être émise après clôture de la mission. Vérifiez les dates avant confirmation.</p>
       <label className="block">Date réelle de prestation <Input type="date" value={serviceDate} onChange={e=>setServiceDate(e.target.value)}/></label>
       <label className="block">Date limite de paiement <Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
       <Button type="button" disabled={busy||!completed||!serviceDate||!dueDate} onClick={()=>issue(q)}>Émettre la facture définitive</Button>
      </div>}
      {invoice&&<div className="border-t pt-3">
       <p>Facture {invoice.invoice_number} · {new Date(invoice.issued_at).toLocaleDateString("fr-FR")} · <strong>{payments.some(p=>p.invoice_id===invoice.id&&p.state==="paid")?"Paiement Stripe confirmé (TEST uniquement)":"Paiement non confirmé"}</strong></p>
       {testCheckoutUI&&!payments.some(p=>p.invoice_id===invoice.id&&["pending","open","paid"].includes(p.state))&&
        <Button type="button" disabled={busy} size="sm" variant="outline" onClick={()=>void startTestCheckout(invoice)}>Créer un lien Stripe — TEST</Button>}
       {payments.some(p=>p.invoice_id===invoice.id&&["pending","open"].includes(p.state))&&<p>Session de paiement test active. Vérifiez le paiement chez Stripe avant toute nouvelle tentative.</p>}
       <Link to="/facture/$invoiceId" params={{invoiceId:invoice.id}} className="mt-2 inline-block underline">Consulter et imprimer la facture</Link>
      </div>}
     </article>;
    })}
   </div>
  </div>}
 </section>;
}
