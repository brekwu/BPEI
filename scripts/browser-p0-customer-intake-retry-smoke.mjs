import assert from "node:assert/strict";
import {chromium} from "playwright";

/** P0 safe customer form smoke. Requests go to a simulated Supabase backend. */
const browser=await chromium.launch({headless:true});
const origin=process.env.BPEI_SMOKE_ORIGIN||"http://127.0.0.1:3000";
const respond=(obj,status=200)=>({status,contentType:"application/json",body:JSON.stringify(obj)});
const errors=[];
let enabled=false,attempts=0;
const context=await browser.newContext();
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const singular=(req.headers().accept||"").includes("application/vnd.pgrst.object+json");
 if(path==="/rest/v1/bpei_intake_flags")
   return route.fulfill(respond({enabled}));
 if(path==="/rest/v1/bpei_launch_controls")
   return route.fulfill(respond({legal_documents_published:enabled,legal_version:enabled?"p0-test-v1":null}));
 if(path==="/rest/v1/bpei_inquiries"&&req.method()==="POST"){
   attempts++;
   if(attempts===1)return route.fulfill(respond({message:"Temporary outage",code:"503"},503));
   return route.fulfill({status:201,body:"",headers:{"content-type":"application/json"}});
 }
 return route.fulfill(respond(singular?null:[]));
});
try{
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 let response=await page.goto(origin+"/contact",{waitUntil:"domcontentloaded"});
 assert.equal(response?.status(),200);
 await page.getByText("Formulaire en préparation").waitFor({timeout:15000});
 assert.equal(await page.getByRole("button",{name:"Envoyer le message"}).count(),0);
 assert.equal(attempts,0,"Closed intake must never send");
 enabled=true;
 response=await page.reload({waitUntil:"domcontentloaded"});
 assert.equal(response?.status(),200);
 await page.getByRole("button",{name:"Envoyer le message"}).waitFor({timeout:15000});
 await page.getByRole("textbox",{name:/Nom et prénom/}).fill("Utilisateur de recette");
 await page.getByRole("textbox",{name:/E-mail/}).fill("test@example.invalid");
 await page.getByRole("textbox",{name:/Sujet/}).fill("Demande de renseignement");
 await page.getByRole("textbox",{name:/Description/}).fill("Ceci est un test de formulaire sans envoi.");
 await page.getByRole("checkbox").check();
 const submit=page.getByRole("button",{name:"Envoyer le message"});
 await submit.click();
 await page.getByText(/Envoi impossible. Le service est peut-être encore fermé/).waitFor({timeout:15000});
 assert.equal(await submit.isEnabled(),true,"Failed request must allow another attempt");
 await submit.click();
 await page.getByText(/Votre demande a été enregistrée/).waitFor({timeout:15000});
 assert.equal(attempts,2,"One failed and one successful simulated request");
 assert.deepEqual(errors,[],"Unexpected browser exceptions");
 console.log(JSON.stringify({ok:true,mode:"mocked-customer-intake",attempts}));
}finally{
 await context.close();
 await browser.close();
}
