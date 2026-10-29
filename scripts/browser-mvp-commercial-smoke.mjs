import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

/** Mock-only commercial acceptance. Does not issue legal invoices or payments. */
const engine=process.env.BPEI_BROWSER_ENGINE??"chromium";
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const ctx=await browser.newContext();
const base=process.env.BPEI_SMOKE_ORIGIN??"http://127.0.0.1:3000";
const id="77777777-7777-4777-8777-777777777777";
const inquiryId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const quoteId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const invoiceId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const user={id,email:"admin-mvp@example.invalid",role:"authenticated",aud:"authenticated",user_metadata:{},app_metadata:{provider:"email",providers:["email"]}};
const customer={id:inquiryId,client_name:"Marie Exemple",email:"marie@example.invalid",
 phone:"0612345678",address_line1:"12 rue du Marché",postal_code:"06000",city:"Nice",
 subject:"Dépannage réseau",status:"assigned",assigned_to:id,customer_kind:"individual"};
const quote={id:quoteId,inquiry_id:inquiryId,issuer_id:id,status:"proposed",
 issuer_legal_name:"Jean Exemple EI",issuer_siret:"12345678901234",
 issuer_address:"14 rue des Ateliers, 06000 Nice",issuer_email:"jean@example.invalid",
 tax_mention:"",customer_name:customer.client_name,customer_email:customer.email,
 customer_address:"12 rue du Marché, 06000, Nice",customer_kind:"individual",customer_siret:null,
 service_description:"Intervention réseau à domicile",quantity:1,unit_price_cents:9000,
 vat_basis_points:2000,net_cents:9000,vat_cents:1800,gross_cents:10800,accepted_at:null};
const invoice={id:invoiceId,quote_id:quoteId,invoice_number:"2026-000001",
 issued_at:"2026-10-29T12:00:00Z",service_date:"2026-10-29",due_date:"2026-10-30",payment_status:"unpaid"};
let step=0,rpcCreates=0,rpcAccepts=0,rpcInvoices=0;
const errors=[];
const json=(data,status=200)=>({status,contentType:"application/json",body:JSON.stringify(data)});
await ctx.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),path=new URL(req.url()).pathname,headers=req.headers();
 const single=(headers.accept??"").includes("application/vnd.pgrst.object+json");
 if(path==="/auth/v1/token")return route.fulfill(json({
  user,access_token:"mock-mvp.access.signature",refresh_token:"mock-mvp-refresh",
  token_type:"bearer",expires_in:3600
 }));
 if(path==="/auth/v1/user")return route.fulfill(json(user));
 if(path==="/auth/v1/logout")return route.fulfill({status:204,body:""});
 if(path.startsWith("/auth/v1/"))return route.fulfill(json({message:"no auth"},401));
 if(path==="/rest/v1/bpei_launch_controls")return route.fulfill(json({id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null}));
 if(path==="/rest/v1/independent_admins")return route.fulfill(json(single?{user_id:id}:[{user_id:id}]));
 if(path==="/rest/v1/bpei_inquiries")return route.fulfill(json([customer]));
 if(path==="/rest/v1/independent_requests")return route.fulfill(json([{inquiry_id:inquiryId,status:"completed"}]));
 if(path==="/rest/v1/bpei_service_quotes")return route.fulfill(json(single?quote:step>0?[quote]:[]));
 if(path==="/rest/v1/bpei_service_invoices")return route.fulfill(json(single?invoice:step>2?[invoice]:[]));
 if(path==="/rest/v1/rpc/mvp_create_quote"){rpcCreates++;step=1;return route.fulfill(json(quoteId));}
 if(path==="/rest/v1/rpc/mvp_accept_quote"){rpcAccepts++;step=2;quote.status="accepted";quote.accepted_at="2026-10-29T10:00:00Z";return route.fulfill(json(true));}
 if(path==="/rest/v1/rpc/mvp_issue_invoice"){rpcInvoices++;step=3;return route.fulfill(json(invoiceId));}
 return route.fulfill(json(single?null:[]));
});
try{
 const login=await ctx.newPage();login.on("pageerror",e=>errors.push(e.message));
 await login.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await login.getByPlaceholder("Adresse e-mail").fill(user.email);
 await login.getByPlaceholder("Mot de passe",{exact:true}).fill("Mock-password-2026!");
 await login.getByRole("button",{name:"Se connecter",exact:true}).click();
 await login.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});
 const page=await ctx.newPage();page.on("pageerror",e=>errors.push(e.message));
 page.on("dialog",dialog=>dialog.accept());
 await page.goto(base+"/gestion-commerciale",{waitUntil:"domcontentloaded"});
 await page.getByRole("heading",{name:"Devis et factures — MVP"}).waitFor({timeout:15000});
 await page.getByText("Aucun devis pour le moment.").waitFor({timeout:15000});
 await page.getByRole("combobox",{name:"Demande attribuée à un indépendant"}).selectOption(inquiryId);
 await page.getByRole("textbox",{name:/Nom légal du prestataire/}).fill("Jean Exemple EI");
 await page.getByRole("textbox",{name:/E-mail professionnel du prestataire/}).fill("jean@example.invalid");
 await page.getByRole("textbox",{name:/Adresse professionnelle du prestataire/}).fill("14 rue des Ateliers, 06000 Nice");
 await page.getByRole("textbox",{name:/Prestation facturée/}).fill(quote.service_description);
 await page.getByRole("textbox",{name:/Prix unitaire HT/}).fill("90,00");
 await page.getByRole("combobox",{name:/TVA applicable/}).selectOption("2000");
 await page.getByRole("button",{name:"Créer le devis"}).click();
 await page.getByText("Devis enregistré.",{exact:false}).waitFor({timeout:15000});
 await page.getByText("Total TTC",{exact:false}).waitFor({timeout:15000});
 assert.equal(rpcCreates,1);
 await page.getByRole("textbox",{name:/Référence de la preuve/}).fill("courriel-client-29-10-2026");
 await page.getByRole("button",{name:"Enregistrer l'acceptation"}).click();
 await page.getByText("Acceptation du client enregistrée",{exact:false}).waitFor({timeout:15000});
 assert.equal(rpcAccepts,1);
 await page.getByLabel("Date réelle de prestation").fill("2026-10-29");
 await page.getByLabel("Date limite de paiement").fill("2026-10-30");
 await page.getByRole("button",{name:"Émettre la facture définitive"}).click();
 await page.getByText("Facture définitive enregistrée",{exact:false}).waitFor({timeout:15000});
 await page.getByText("Facture 2026-000001",{exact:false}).waitFor({timeout:15000});
 assert.equal(rpcInvoices,1);
 await page.getByRole("link",{name:"Consulter et imprimer la facture"}).click();
 await page.getByRole("heading",{name:"FACTURE",exact:true}).waitFor({timeout:15000});
 await page.getByText("2026-000001").first().waitFor();
 assert.equal(await page.getByText("Non confirmé / impayé",{exact:false}).count(),1);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,mode:"mocked-mvp-commercial",created:rpcCreates,accepted:rpcAccepts,invoiced:rpcInvoices,paid:false,errors:0}));
}finally{await ctx.close();await browser.close();}
