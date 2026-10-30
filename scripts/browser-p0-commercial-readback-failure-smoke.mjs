import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

/**
 * P0 mocked-browser financial safety regression:
 * a successful quote RPC followed by a denied read is UNKNOWN, not "saved".
 * It must hide customer PII and require explicit reloading (no retrying writes).
 */
const engine=process.env.BPEI_BROWSER_ENGINE??"chromium";
assert.ok(["chromium","webkit"].includes(engine));
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const ctx=await browser.newContext();
const base=process.env.BPEI_SMOKE_ORIGIN??"http://127.0.0.1:3000";
const id="77777777-7777-4777-8777-777777777777";
const inquiryId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const quoteId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user={id,email:"commercial-readback@example.invalid",role:"authenticated",aud:"authenticated",
 email_confirmed_at:"2026-10-28T10:00:00Z",user_metadata:{},
 app_metadata:{provider:"email",providers:["email"]}};
const client={id:inquiryId,client_name:"Client Privé Readback",email:"sensitive@example.invalid",
 phone:"0612345678",address_line1:"12 rue fictive",postal_code:"06000",city:"Nice",
 subject:"Dépannage informatique",status:"assigned",assigned_to:id,customer_kind:"individual"};
const quote={id:quoteId,inquiry_id:inquiryId,issuer_id:id,status:"proposed",
 issuer_legal_name:"Prestataire fictif EI",issuer_siret:"12345678901234",
 customer_kind:"individual",customer_name:client.client_name,service_description:"Dépannage informatique",
 quantity:1,unit_price_cents:9000,vat_basis_points:0,net_cents:9000,vat_cents:0,gross_cents:9000,accepted_at:null};
let created=0,denyRead=false,requestsDenied=0;
const errors=[];
const json=(data,status=200)=>({status,contentType:"application/json",
 headers:{
  "access-control-allow-origin":"*",
  "access-control-allow-methods":"GET,POST,OPTIONS",
  "access-control-allow-headers":"authorization,apikey,content-type,x-client-info"
 },
 body:JSON.stringify(data)});
await ctx.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),p=new URL(req.url()).pathname;
 const single=(req.headers().accept??"").includes("application/vnd.pgrst.object+json");
 if(p==="/auth/v1/token")return route.fulfill(json({user,
  access_token:"mock-commercial-readback.token.signature",
  refresh_token:"mock-commercial-readback-refresh",expires_in:3600,token_type:"bearer"}));
 if(p==="/auth/v1/user")return route.fulfill(json(user));
 if(p==="/auth/v1/logout")return route.fulfill({status:204,body:""});
 if(p.startsWith("/auth/v1/"))return route.fulfill(json({message:"No session"},401));
 if(p==="/rest/v1/independent_admins")return route.fulfill(json(single?{user_id:id}:[{user_id:id}]));
 if(p==="/rest/v1/bpei_launch_controls")return route.fulfill(json({
  id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null
 }));
 if(p==="/rest/v1/rpc/mvp_create_quote"){
  created+=1;denyRead=true;return route.fulfill(json(quoteId));
 }
 if(p==="/rest/v1/bpei_inquiries"){
  if(denyRead){requestsDenied++;return route.fulfill(json({code:"PGRST301",message:"Read unavailable"},403));}
  return route.fulfill(json([client]));
 }
 if(p==="/rest/v1/bpei_service_quotes")return route.fulfill(json(created?[quote]:[]));
 if(p==="/rest/v1/independent_requests")
  return route.fulfill(json([{inquiry_id:inquiryId,status:"completed"}]));
 if(p.startsWith("/rest/v1/rpc/"))return route.fulfill(json({message:"Denied"},403));
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
 page.on("dialog",d=>d.accept());
 await page.goto(base+"/gestion-commerciale",{waitUntil:"domcontentloaded"});
 const section=page.locator('section[aria-label="Gestion commerciale BPEI"]');
 await section.getByRole("combobox",{name:"Demande attribuée à un indépendant"}).selectOption(inquiryId,{timeout:15000});
 await section.getByRole("textbox",{name:/Nom légal du prestataire/}).fill("Prestataire fictif EI");
 await section.getByRole("textbox",{name:/E-mail professionnel du prestataire/}).fill("prestataire@example.invalid");
 await section.getByRole("textbox",{name:/Adresse professionnelle du prestataire/}).fill("14 rue des Ateliers, 06000 Nice");
 await section.getByRole("textbox",{name:/Prestation facturée/}).fill("Intervention réseau à domicile");
 await section.getByRole("textbox",{name:/Prix unitaire HT/}).fill("90,00");
 await section.getByRole("combobox",{name:/TVA applicable/}).selectOption("0");
 await section.getByRole("textbox",{name:/Mention fiscale si TVA à 0/}).fill("TVA non applicable, article 293 B du CGI");
 await section.getByRole("button",{name:"Créer le devis"}).click();

 await section.getByText("Action potentiellement enregistrée, mais lecture de confirmation indisponible.",{exact:false}).waitFor({timeout:15000});
 assert.equal(created,1,"A write may not be automatically repeated after a readback error");
 assert.ok(requestsDenied>=1);
 assert.equal(await section.getByText(client.client_name,{exact:false}).count(),0,
  "Private customer data stayed visible after a denied data read");
 assert.equal(await section.getByText("Devis enregistré.",{exact:false}).count(),0,
  "A failed readback was incorrectly reported as confirmed");

 denyRead=false;
 await section.getByRole("button",{name:"Actualiser"}).click();
 await section.getByText(client.client_name,{exact:false}).first().waitFor({timeout:15000});
 await section.getByText("Total TTC",{exact:false}).waitFor({timeout:15000});
 assert.equal(created,1,"Manual refresh should not create a second quote");
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,mode:"mocked-commercial-write-readback",
  rpcWrites:created,failedReads:requestsDenied,duplicateWrites:0}));
}finally{await ctx.close();await browser.close();}
