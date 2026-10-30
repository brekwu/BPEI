import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

/**
 * Mock-only P0 privacy regression: a late invoice fetch MUST NOT resurrect
 * a customer's personal data after sign-out in another browser tab.
 * No real Auth users, invoices, Stripe transactions or external network calls.
 */
const engine=process.env.BPEI_BROWSER_ENGINE??"chromium";
assert.ok(["chromium","webkit"].includes(engine));
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const base=process.env.BPEI_SMOKE_ORIGIN??"http://127.0.0.1:3000";
const id="12345678-1234-4234-8234-123456789012";
const invoiceId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const quoteId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user={id,email:"admin-invoice@example.invalid",role:"authenticated",
 aud:"authenticated",email_confirmed_at:"2026-10-28T10:00:00Z",
 app_metadata:{provider:"email",providers:["email"]},user_metadata:{}};
const quote={id:quoteId,issuer_legal_name:"Prestataire fictif EI",issuer_siret:"12345678901234",
 issuer_address:"Adresse fictive",issuer_email:"prestataire@example.invalid",
 tax_mention:"",customer_name:"Client confidentiel",customer_email:"private-customer@example.invalid",
 customer_address:"Adresse client confidentielle",customer_kind:"individual",customer_siret:null,
 service_description:"Intervention réseau test",quantity:1,unit_price_cents:9000,
 vat_basis_points:0,net_cents:9000,vat_cents:0,gross_cents:9000,accepted_at:"2026-10-28T10:00:00Z"};
const invoice={id:invoiceId,quote_id:quoteId,invoice_number:"2026-000001",issued_at:"2026-10-29T12:00:00Z",
 service_date:"2026-10-29",due_date:"2026-10-30",payment_status:"unpaid",
 issuer_vat_number:null,payment_terms:"Sous dix jours",
 early_payment_discount:"Aucun escompte applicable",late_payment_penalties:null,
 customer_order_reference:null,b2b_recovery_fee_cents:null};
let allowQuote;
const heldQuote=new Promise(resolve=>{allowQuote=resolve});
let notifyQuote;
const quoteRequested=new Promise(resolve=>{notifyQuote=resolve});
const errors=[];
const cors={
 "access-control-allow-origin":new URL(base).origin,
 "access-control-allow-credentials":"true",
 "access-control-allow-methods":"GET,POST,PATCH,PUT,DELETE,OPTIONS",
 "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
 "access-control-expose-headers":"content-range,range",
 "vary":"Origin"
};
const json=(data,status=200)=>({
 status,contentType:"application/json",headers:cors,body:JSON.stringify(data)
});
const context=await browser.newContext();
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname;
 if(req.method()==="OPTIONS")return route.fulfill({
  status:204,body:"",
  headers:{...cors,"access-control-allow-headers":
    req.headers()["access-control-request-headers"]??cors["access-control-allow-headers"]}
 });
 const single=(req.headers().accept??"").includes("application/vnd.pgrst.object+json");
 if(path==="/auth/v1/token")return route.fulfill(json({
  user,access_token:"mock-p0-invoice.token.signature",
  refresh_token:"mock-p0-invoice-refresh",expires_in:3600,token_type:"bearer"}));
 if(path==="/auth/v1/user")return route.fulfill(json(user));
 if(path==="/auth/v1/logout")return route.fulfill({status:204,body:""});
 if(path.startsWith("/auth/v1/"))return route.fulfill(json({message:"No session"},401));
 if(path==="/rest/v1/bpei_launch_controls")
  return route.fulfill(json({id:true,legal_documents_published:false,
   independent_registration_enabled:false,legal_version:null}));
 if(path==="/rest/v1/bpei_service_invoices")return route.fulfill(json(single?invoice:[invoice]));
 if(path==="/rest/v1/bpei_service_quotes"){
  notifyQuote();
  await heldQuote;
  return route.fulfill(json(single?quote:[quote]));
 }
 return route.fulfill(json(single?null:[]));
});
try{
 const login=await context.newPage();
 login.on("pageerror",e=>errors.push(e.message));
 await login.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await login.getByPlaceholder("Adresse e-mail").fill(user.email);
 await login.getByPlaceholder("Mot de passe",{exact:true}).fill("Mock-password-2026!");
 await login.getByRole("button",{name:"Se connecter",exact:true}).click();
 await login.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});

 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base+"/facture/"+invoiceId,{waitUntil:"domcontentloaded"});
 await Promise.race([quoteRequested,new Promise((_,reject)=>
  setTimeout(()=>reject(Error("Invoice quote request was never started")),15000))]);
 await login.getByRole("button",{name:"Se déconnecter"}).click();
 await page.getByText("Session terminée.").waitFor({timeout:15000});
 allowQuote();
 await page.waitForTimeout(400);
 assert.equal(await page.getByText("Client confidentiel").count(),0,
  "Invoice personal data resurrected after cross-tab sign-out");
 assert.equal(await page.getByText("private-customer@example.invalid").count(),0,
  "Customer email was exposed after sign-out");
 assert.equal(await page.locator("#bpei-invoice-print").count(),0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,mode:"mocked-invoice-cross-tab-signout",
  staleCustomerData:0,realTransactions:0}));
}finally{
 allowQuote?.();
 await context.close();
 await browser.close();
}
