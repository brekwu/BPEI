import {stubMockInboxNotifications} from "./mock-hidden-inbox-notifications.mjs";
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

/**
 * P0 mocked-browser legal version isolation regression.
 * No real Auth, legal approval, PII, email, payment or Supabase mutation.
 * Two in-flight document reads intentionally finish in reverse order.
 */
const engine=process.env.BPEI_BROWSER_ENGINE ?? "chromium";
assert.ok(["chromium","webkit"].includes(engine));
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const base=process.env.BPEI_SMOKE_ORIGIN??"http://127.0.0.1:3000";
const user={id:"12345678-1234-4234-8234-123456789012",email:"admin-p0@example.invalid",
 role:"authenticated",aud:"authenticated",email_confirmed_at:"2026-10-28T10:00:00Z",
 app_metadata:{provider:"email",providers:["email"]},user_metadata:{}};
const initialVersion="bpei-2026-v1";
const nextVersion="bpei-mocked-v2";
const firstDoc="Ancien document de test. "+"A".repeat(340);
const secondDoc="Nouveau document de test. "+"B".repeat(340);
const kinds=["mentions-legales","confidentialite","cgu"];
const docs=(version,content)=>kinds.map(kind=>({
 kind,version,content,approved_at:"2026-10-28T10:00:00Z"
}));
let releaseFirst;
let releaseSecond;
const firstGate=new Promise(resolve=>{releaseFirst=resolve;});
const secondGate=new Promise(resolve=>{releaseSecond=resolve;});
let firstReceived=false,secondReceived=false;
let approveRecorded=false;
let deniedLegalReads=0;
let notifyFirst,notifySecond;
const firstRequested=new Promise(resolve=>{notifyFirst=resolve;});
const secondRequested=new Promise(resolve=>{notifySecond=resolve;});
async function expectRequested(promise,label){
 let timer;
 try{
  await Promise.race([promise,new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new Error(label+" request missing")),12000);
  })]);
 } finally { clearTimeout(timer); }
}
const errors=[];
const context=await browser.newContext();
await stubMockInboxNotifications(context);
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
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(), url=new URL(req.url()), path=url.pathname;
 if(req.method()==="OPTIONS")return route.fulfill({
  status:204,body:"",
  headers:{...cors,"access-control-allow-headers":
    req.headers()["access-control-request-headers"]??cors["access-control-allow-headers"]}
 });
 const single=(req.headers().accept??"").includes("application/vnd.pgrst.object+json");
 if(path==="/rest/v1/bpei_notifications"){
   // The inbox makes both GET list and HEAD exact-count requests.
   // Match PostgREST's count headers; never leak to the real network.
   return route.fulfill({
     status:200,
     headers:{...cors,"content-type":"application/json","content-range":"*/0"},
     body:req.method()==="HEAD"?"":"[]"
   });
  }
 
 if(path==="/auth/v1/token")return route.fulfill(json({
  user,access_token:"mock-p0-admin.token.signature",
  refresh_token:"mock-p0-admin-refresh",expires_in:3600,token_type:"bearer"
 }));
 if(path==="/auth/v1/user")return route.fulfill(json(user));
 if(path==="/auth/v1/logout")return route.fulfill({status:204,body:""});
 if(path.startsWith("/auth/v1/"))return route.fulfill(json({message:"No session"},401));
 if(path==="/rest/v1/independent_admins")
  return route.fulfill(json(single?{user_id:user.id}:[{user_id:user.id}]));
 if(path==="/rest/v1/bpei_launch_controls")
  return route.fulfill(json({id:true,legal_documents_published:false,
   independent_registration_enabled:false,legal_version:null}));
 if(path==="/rest/v1/bpei_legal_releases")return route.fulfill(json([]));
 if(path==="/rest/v1/bpei_legal_documents"){
  const selected=url.searchParams.get("version");
  if(selected==="eq."+initialVersion){
   firstReceived=true;notifyFirst();
   await firstGate;
   return route.fulfill(json(docs(initialVersion,firstDoc)));
  }
  if(selected==="eq."+nextVersion){
   if(approveRecorded){
    deniedLegalReads++;
    return route.fulfill(json({message:"Authorization lost during legal readback"},403));
   }
   secondReceived=true;notifySecond();
   await secondGate;
   return route.fulfill(json(docs(nextVersion,secondDoc)));
  }
  return route.fulfill(json([]));
 }
 if(path==="/rest/v1/rpc/approve_bpei_legal_document"){
  approveRecorded=true;
  return route.fulfill(json(null,200));
 }
 if(path.startsWith("/rest/v1/rpc/"))return route.fulfill(json({message:"Not available"},403));
 return route.fulfill(json(single?null:[]));
});
try{
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await page.getByPlaceholder("Adresse e-mail").fill(user.email);
 await page.getByPlaceholder("Mot de passe",{exact:true}).fill("Mock-password-2026!");
 await page.getByRole("button",{name:"Se connecter",exact:true}).click();
 await page.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});
 await page.goto(base+"/gestion-independants",{waitUntil:"domcontentloaded"});
 const section=page.locator('[aria-label="Documents juridiques BPEI"]');
 await section.waitFor({timeout:15000});
 const version=section.getByLabel("Version juridique (3 à 90 caractères)");
 const approve=section.getByRole("button",{name:"Valider ce document"}).first();
 const firstText=section.locator("textarea").first();
 await expectRequested(firstRequested,"Initial legal version");
 await version.fill(nextVersion);
 // The new version must remain locked while it is still loading.
 assert.equal(await approve.isDisabled(),true);
 await expectRequested(secondRequested,"New legal version");
 assert.equal(secondReceived,true,"New version's request must be issued");
 releaseSecond();
 await page.waitForFunction(
  ({prefix})=>document.querySelector('[aria-label="Documents juridiques BPEI"] textarea')?.value.startsWith(prefix),
  {prefix:"Nouveau document de test."},{timeout:12000}
 );
 assert.ok((await firstText.inputValue()).startsWith("Nouveau document de test."));
 releaseFirst();
 await page.waitForTimeout(250);
 assert.ok((await firstText.inputValue()).startsWith("Nouveau document de test."),
  "Old async read replaced drafts for a different version");
 assert.equal(await version.inputValue(),nextVersion);
 // A write can be committed while the following privileged read fails.
 // Do not leave last-known legal drafts visible after such a failure.
 page.on("dialog",dialog=>dialog.accept());
 await approve.click();
 await section.getByText("Validation potentiellement enregistrée",{exact:false}).waitFor({timeout:15000});
 assert.ok(approveRecorded&&deniedLegalReads>=1,
  "The test must exercise a successful write followed by refused readback");
 assert.equal(await firstText.inputValue(),"",
  "Private legal draft remained visible after an unauthorized readback");
 assert.equal(await approve.isDisabled(),true,
  "Approval must stay disabled after a failed admin readback");
 assert.equal(await section.getByText("Validé pour cette version").count(),0,
  "Stale approval history must not be presented as verified");
 await section.getByRole("button",{name:"Recharger les documents"}).click();
 await section.getByText("Lecture juridique refusée ou incomplète",{exact:false}).waitFor({timeout:15000});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,mode:"mocked-legal-race-and-readback-denied",
  firstReceived,secondReceived,deniedLegalReads,staleDrafts:0}));
} finally {
 releaseFirst?.();
 releaseSecond?.();
 await context.close();
 await browser.close();
}
