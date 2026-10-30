// BPEI quote/invoice email: fail closed pending verified sender, legal approval and operator action.
import {createClient} from "npm:@supabase/supabase-js@2";
import {renderCommercialPdf,type CommercialDocument} from "./pdf.ts";
const response=(status:number,data:unknown,origin="")=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
 ...(origin?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{})}
});
Deno.serve(async req=>{
 const originConfigured=Deno.env.get("BPEI_COMMERCIAL_MAIL_ORIGIN")??"";
 let origin="";
 try{
  const u=new URL(originConfigured);
  if(u.protocol==="https:"&&u.pathname==="/"&&!u.search&&!u.hash&&!u.username&&!u.password)
   origin=u.origin;
 }catch{/* no trusted browser origin */}
 const actualOrigin=req.headers.get("Origin");
 if(req.method==="OPTIONS"){
  if(origin&&actualOrigin===origin)
   return new Response(null,{status:204,headers:{
    "Access-Control-Allow-Origin":origin,
    "Access-Control-Allow-Methods":"POST,OPTIONS",
    "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
    "Vary":"Origin"
   }});
  return response(403,{error:"origin_denied"});
 }
 if(req.method!=="POST")return response(405,{error:"method_not_allowed"});
 if(actualOrigin&&actualOrigin!==origin)return response(403,{error:"origin_denied"});
 const enabled=Deno.env.get("BPEI_COMMERCIAL_MAIL_ENABLED")==="true";
 const key=Deno.env.get("RESEND_API_KEY")??"";
 const from=Deno.env.get("BPEI_COMMERCIAL_MAIL_FROM")??"";
 const footer=Deno.env.get("BPEI_COMMERCIAL_MAIL_LEGAL_FOOTER")??"";
 const url=Deno.env.get("SUPABASE_URL")??"";
 const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!enabled||!origin||!key.startsWith("re_")||!url.startsWith("https://")||!secret
  ||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)||footer.trim().length<40)
  return response(503,{error:"commercial_mail_not_configured"},origin);
 const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")??"";
 if(!bearer)return response(401,{error:"login_required"},origin);
 let input:unknown;
 try{input=await req.json()}catch{return response(400,{error:"invalid_json"},origin)}
 if(!input||typeof input!=="object")return response(400,{error:"invalid_payload"},origin);
 const payload=input as Record<string,unknown>;
 const kind=payload.kind;
 const id=payload.document_id;
 if((kind!=="quote"&&kind!=="invoice")||typeof id!=="string"
  ||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  return response(400,{error:"invalid_document"},origin);
 let reservedId="";
 let admin:any=null;
 try{
  admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await admin.auth.getUser(bearer);
  if(authError||!auth.user||auth.user.is_anonymous||!auth.user.email_confirmed_at)
   return response(401,{error:"confirmed_identity_required"},origin);
  const [{data:role,error:roleError},{data:legal,error:legalError},{data:controls,error:controlsError}]=await Promise.all([
   admin.from("independent_admins").select("user_id").eq("user_id",auth.user.id).maybeSingle(),
   admin.from("bpei_launch_controls").select("legal_documents_published,legal_version").eq("id",true).maybeSingle(),
   admin.from("bpei_commercial_mail_controls").select("enabled,validated_legal_sender").eq("id",true).maybeSingle()
  ]);
  if(roleError||!role)return response(403,{error:"admin_required"},origin);
  if(legalError||legal?.legal_documents_published!==true||!legal.legal_version
   ||controlsError||controls?.enabled!==true||controls.validated_legal_sender!==true)
   return response(403,{error:"legal_delivery_not_approved"},origin);
  let invoice:any=null;
  if(kind==="invoice"){
   const result=await admin.from("bpei_service_invoices")
    .select("id,quote_id,invoice_number,issued_at,service_date,due_date,issuer_vat_number,payment_terms,early_payment_discount,late_payment_penalties,customer_order_reference,b2b_recovery_fee_cents")
    .eq("id",id).maybeSingle();
   if(result.error||!result.data)return response(404,{error:"invoice_not_found"},origin);
   invoice=result.data;
  }
  const quoteId=kind==="quote"?id:invoice.quote_id;
  const {data:q,error:quoteError}=await admin.from("bpei_service_quotes")
   .select("id,status,created_at,issuer_legal_name,issuer_siret,issuer_address,issuer_email,customer_name,customer_email,customer_address,customer_kind,customer_siret,service_description,quantity,unit_price_cents,vat_basis_points,tax_mention,net_cents,vat_cents,gross_cents")
   .eq("id",quoteId).maybeSingle();
  if(quoteError||!q)return response(404,{error:"quote_not_found"},origin);
  if(kind==="invoice"&&q.status!=="accepted")return response(409,{error:"quote_not_accepted"},origin);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.customer_email))
   return response(409,{error:"invalid_customer_email"},origin);
  const bill:CommercialDocument={
   kind,documentId:id,invoiceNumber:invoice?.invoice_number,
   issuedAt:invoice?.issued_at??q.created_at,
   serviceDate:invoice?.service_date,dueDate:invoice?.due_date,
   issuerLegalName:q.issuer_legal_name,issuerSiret:q.issuer_siret,
   issuerAddress:q.issuer_address,issuerEmail:q.issuer_email,
   customerName:q.customer_name,customerEmail:q.customer_email,
   customerAddress:q.customer_address,customerKind:q.customer_kind,
   customerSiret:q.customer_siret,description:q.service_description,
   quantity:q.quantity,unitPriceCents:q.unit_price_cents,
   netCents:q.net_cents,vatCents:q.vat_cents,grossCents:q.gross_cents,
   vatBasisPoints:q.vat_basis_points,taxMention:q.tax_mention,
   issuerVatNumber:invoice?.issuer_vat_number,paymentTerms:invoice?.payment_terms,
   earlyPaymentDiscount:invoice?.early_payment_discount,
   latePaymentPenalties:invoice?.late_payment_penalties,
   customerOrderReference:invoice?.customer_order_reference,
   b2bRecoveryFeeCents:invoice?.b2b_recovery_fee_cents
  };
  // Render before reserving send: unsupported legal characters must not block the outbox.
  const content=await renderCommercialPdf(bill,footer);
  const {data:reserved,error:reserveError}=await admin.from("bpei_commercial_mail_outbox")
   .insert({kind,document_id:id,recipient:q.customer_email,created_by:auth.user.id,status:"processing"})
   .select("id").single();
  if(reserveError||!reserved?.id){
   return response(409,{error:"delivery_already_reserved_or_unavailable"},origin);
  }
  reservedId=reserved.id;
  const name=kind==="invoice"?"Facture":"Devis";
  const number=invoice?.invoice_number??q.id;
  const body={
   from,to:[q.customer_email],
   reply_to:q.issuer_email,
   subject:"BPEI - "+name+" "+number+" de "+q.issuer_legal_name,
   text:"Bonjour,\n\nVotre "+name.toLowerCase()+" "+number+" est joint en PDF. L'émetteur est "+q.issuer_legal_name+" (SIRET "+q.issuer_siret+").\n\nCe document est issu de la préproduction BPEI et doit être validé pour toute utilisation commerciale.\n\nCordialement,\nBPEI",
   attachments:[{filename:(kind==="invoice"?"facture-":"devis-")+number.replace(/[^A-Za-z0-9_-]/g,"-")+".pdf",
    content,content_type:"application/pdf"}]
  };
  const send=await fetch("https://api.resend.com/emails",{
   method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json",
    "Idempotency-Key":"bpei-commercial-"+kind+"-"+id},
   body:JSON.stringify(body)
  });
  const result=await send.json().catch(()=>null);
  if(!send.ok||!result||typeof result.id!=="string")throw Error("Provider send refused");
  const {error:saved}=await admin.from("bpei_commercial_mail_outbox")
   .update({status:"sent",provider_message_id:result.id,completed_at:new Date().toISOString()})
   .eq("id",reservedId).eq("status","processing");
  if(saved)throw Error("Delivery recorded at provider but ledger update failed");
  return response(200,{status:"sent"},origin);
 }catch(e){
  console.error("BPEI commercial email failed",e instanceof Error?e.message:"unknown");
  // Leave a reserved message in UNKNOWN state, preventing blind duplicate sends.
  if(reservedId&&admin)await admin.from("bpei_commercial_mail_outbox")
   .update({status:"unknown",completed_at:new Date().toISOString()})
   .eq("id",reservedId).eq("status","processing").catch(()=>{});
  return response(503,{error:"delivery_failed_or_requires_manual_review"},origin);
 }
});
