import {stubMockInboxNotifications} from "./mock-hidden-inbox-notifications.mjs";
import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

/** Mock-only P0: evidence and invoice drafts cannot leak between customer dossiers. */
const engine=process.env.BPEI_BROWSER_ENGINE??"chromium";
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const ctx=await browser.newContext();
await stubMockInboxNotifications(ctx);
const base=process.env.BPEI_SMOKE_ORIGIN??"http://127.0.0.1:3000";
const id="77777777-7777-4777-8777-777777777777";
const user={id,email:"commercial-isolation@example.invalid",role:"authenticated",aud:"authenticated",
 email_confirmed_at:"2026-10-28T10:00:00Z",user_metadata:{},app_metadata:{provider:"email",providers:["email"]}};
const inquiryIds=["eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","ffffffff-ffff-4fff-8fff-ffffffffffff"];
const quoteIds=["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
const anotherIssuer="99999999-9999-4999-8999-999999999999";
const inquiries=inquiryIds.map((inquiryId,i)=>({
 id:inquiryId,client_name:i===0?"Client Alpha Privé":"Client Beta Privé",
 email:i===0?"alpha@example.invalid":"beta@example.invalid",
 phone:"0612345678",address_line1:"12 rue fictive",postal_code:"06000",city:"Nice",
 subject:"Dépannage informatique",status:"assigned",assigned_to:id,customer_kind:"individual"
}));
const quotes=quoteIds.map((quoteId,i)=>({
 id:quoteId,inquiry_id:inquiryIds[i],issuer_id:i===0?id:anotherIssuer,status:"proposed",
 issuer_legal_name:"Professionnel fictif EI",issuer_siret:"12345678901234",
 customer_kind:"individual",customer_name:inquiries[i].client_name,
 service_description:"Intervention informatique domicile",quantity:1,unit_price_cents:9000,
 vat_basis_points:0,net_cents:9000,vat_cents:0,gross_cents:9000,accepted_at:null
}));
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
await ctx.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),p=new URL(req.url()).pathname;
 if(req.method()==="OPTIONS")return route.fulfill({
  status:204,body:"",
  headers:{...cors,"access-control-allow-headers":
    req.headers()["access-control-request-headers"]??cors["access-control-allow-headers"]}
 });
 const single=(req.headers().accept??"").includes("application/vnd.pgrst.object+json");
 if(p==="/rest/v1/bpei_notifications"){
   // The inbox makes both GET list and HEAD exact-count requests.
   // Match PostgREST's count headers; never leak to the real network.
   return route.fulfill({
     status:200,
     headers:{...cors,"content-type":"application/json","content-range":"*/0"},
     body:req.method()==="HEAD"?"":"[]"
   });
  }
 
 if(p==="/auth/v1/token")return route.fulfill(json({user,
  access_token:"mock-p0-multi.access.signature",refresh_token:"mock-p0-multi-refresh",
  token_type:"bearer",expires_in:3600}));
 if(p==="/auth/v1/user")return route.fulfill(json(user));
 if(p==="/auth/v1/logout")return route.fulfill({status:204,body:""});
 if(p.startsWith("/auth/v1/"))return route.fulfill(json({message:"no auth"},401));
 if(p==="/rest/v1/bpei_launch_controls")return route.fulfill(json({
  id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null
 }));
 if(p==="/rest/v1/independent_admins")return route.fulfill(json(single?{user_id:id}:[{user_id:id}]));
 if(p==="/rest/v1/bpei_inquiries")return route.fulfill(json(inquiries));
 if(p==="/rest/v1/independent_requests")return route.fulfill(json(
  inquiryIds.map(x=>({inquiry_id:x,independent_id:id,status:"completed"}))
 ));
 if(p==="/rest/v1/bpei_service_quotes")return route.fulfill(json(quotes));
 if(p.startsWith("/rest/v1/rpc/"))return route.fulfill(json({message:"Not permitted in mock"},403));
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
 await page.goto(base+"/gestion-commerciale",{waitUntil:"domcontentloaded"});
 const section=page.locator('section[aria-label="Gestion commerciale BPEI"]');
 const alpha=section.locator("article").filter({hasText:"Client Alpha Privé"});
 const beta=section.locator("article").filter({hasText:"Client Beta Privé"});
 await alpha.getByRole("textbox",{name:/Référence de la preuve/}).waitFor({timeout:15000});
 await beta.getByRole("textbox",{name:/Référence de la preuve/}).waitFor({timeout:15000});

 const alphaEvidence=alpha.getByRole("textbox",{name:/Référence de la preuve/});
 const betaEvidence=beta.getByRole("textbox",{name:/Référence de la preuve/});
 await alphaEvidence.fill("accord-alpha-2026-10-30");
 await alpha.getByRole("combobox",{name:"Mode de validation"}).selectOption("signed");
 assert.equal(await betaEvidence.inputValue(),"","Customer B inherited A's acceptance evidence");
 assert.equal(await beta.getByRole("combobox",{name:"Mode de validation"}).inputValue(),"email");
 assert.equal(await beta.getByRole("button",{name:"Enregistrer l'acceptation"}).isDisabled(),true);
 await betaEvidence.fill("accord-beta-2026-10-30");
 assert.equal(await alphaEvidence.inputValue(),"accord-alpha-2026-10-30");
 assert.equal(await alpha.getByRole("combobox",{name:"Mode de validation"}).inputValue(),"signed");

 // Simulate both quotes accepted externally; invoice fields must still be private per quote.
 for(const quote of quotes){quote.status="accepted";quote.accepted_at="2026-10-30T09:00:00Z";}
 await section.getByRole("button",{name:"Actualiser"}).click();
 await alpha.getByLabel("Date réelle de prestation").waitFor({timeout:15000});
 await beta.getByLabel("Date réelle de prestation").waitFor({timeout:15000});
 await alpha.getByLabel("Date réelle de prestation").fill("2026-10-29");
 await alpha.getByLabel("Date limite de paiement").fill("2026-11-05");
 await alpha.getByRole("textbox",{name:/Conditions de règlement exactes/}).fill("Paiement par carte sous sept jours pour Alpha");
 await alpha.getByRole("textbox",{name:/Conditions d'escompte/}).fill("Aucun escompte accordé à Alpha");
 assert.equal(await beta.getByLabel("Date réelle de prestation").inputValue(),"");
 assert.equal(await beta.getByLabel("Date limite de paiement").inputValue(),"");
 assert.equal(await beta.getByRole("textbox",{name:/Conditions de règlement exactes/}).inputValue(),"");
 assert.equal(await beta.getByRole("button",{name:"Émettre la facture définitive"}).isDisabled(),true);
 assert.equal(await alpha.getByRole("textbox",{name:/Conditions de règlement exactes/}).inputValue(),
  "Paiement par carte sous sept jours pour Alpha");
 assert.equal(await alpha.getByRole("button",{name:"Émettre la facture définitive"}).isEnabled(),true,
  "A's quote belongs to the technician who completed A's intervention");

 // Fully specified B terms still cannot invoice work performed by A's technician.
 await beta.getByLabel("Date réelle de prestation").fill("2026-10-29");
 await beta.getByLabel("Date limite de paiement").fill("2026-11-05");
 await beta.getByRole("textbox",{name:/Conditions de règlement exactes/}).fill("Paiement par carte sous sept jours pour Beta");
 await beta.getByRole("textbox",{name:/Conditions d'escompte/}).fill("Aucun escompte accordé à Beta");
 assert.equal(await beta.getByRole("button",{name:"Émettre la facture définitive"}).isDisabled(),true,
  "B's quote must not invoice a mission completed by another issuer");
 await beta.getByText("Mission non terminée",{exact:false}).waitFor();
 await alpha.getByText("Mission terminée",{exact:false}).waitFor();
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,mode:"mocked-two-customer-commercial-drafts",
  clients:2,crossCustomerEvidence:0,crossCustomerInvoiceTerms:0,realWrites:0}));
} finally {await ctx.close();await browser.close();}
