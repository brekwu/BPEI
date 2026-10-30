import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";
import {stubMockInboxNotifications} from "./mock-hidden-inbox-notifications.mjs";

/** Browser regression with mocked Auth and private RPC: no real database access. */
const engine=process.env.BPEI_BROWSER_ENGINE??"chromium";
assert.ok(["chromium","webkit"].includes(engine));
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const base=process.env.BPEI_SMOKE_ORIGIN??"http://127.0.0.1:3000";
const user={id:"12345678-1234-4234-8234-123456789012",email:"p0-readiness@example.invalid",
 role:"authenticated",aud:"authenticated",email_confirmed_at:"2026-10-29T10:00:00Z",
 app_metadata:{provider:"email",providers:["email"]},user_metadata:{}};
const cors={
 "access-control-allow-origin":new URL(base).origin,
 "access-control-allow-credentials":"true",
 "access-control-allow-methods":"GET,POST,PATCH,PUT,DELETE,OPTIONS",
 "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
 "vary":"Origin"
};
const json=(data,status=200)=>({status,contentType:"application/json",headers:cors,body:JSON.stringify(data)});
const context=await browser.newContext();
await stubMockInboxNotifications(context);
let readinessReads=0;
let deferredResponse;
let requestSeen;
const arrived=new Promise(resolve=>{requestSeen=resolve;});
const readiness={mode:"preproduction",all_ready:true,
 checked_at:"2026-10-30T10:00:00Z",checks:{admin_account:{ready:true,verified_accounts:1}}};
const pageErrors=[];
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname;
 if(req.method()==="OPTIONS")return route.fulfill({
  status:204,body:"",headers:{...cors,
   "access-control-allow-headers":req.headers()["access-control-request-headers"]??cors["access-control-allow-headers"]}
 });
 const single=(req.headers().accept??"").includes("application/vnd.pgrst.object+json");
 if(path==="/rest/v1/bpei_notifications")
  return route.fulfill({status:200,headers:{...cors,"content-range":"*/0","content-type":"application/json"},body:req.method()==="HEAD"?"":"[]"});
 if(path==="/auth/v1/token")return route.fulfill(json({user,access_token:"mock.p0.signature",
  refresh_token:"mock-p0-refresh",expires_in:3600,token_type:"bearer"}));
 if(path==="/auth/v1/user")return route.fulfill(json(user));
 if(path==="/auth/v1/logout")return route.fulfill({status:204,body:""});
 if(path.startsWith("/auth/v1/"))return route.fulfill(json({message:"No session"},401));
 if(path==="/rest/v1/independent_admins")return route.fulfill(json(single?{user_id:user.id}:[{user_id:user.id}]));
 if(path==="/rest/v1/bpei_launch_controls")
  return route.fulfill(json({id:true,legal_documents_published:false,
   independent_registration_enabled:false,legal_version:null}));
 if(path==="/rest/v1/rpc/p0_readiness"){
  readinessReads++;
  if(readinessReads===1)return route.fulfill(json(readiness));
  if(readinessReads===2)return route.fulfill(json({message:"Access denied",code:"42501"},403));
  if(readinessReads===3){
   requestSeen();
   await new Promise(resolve=>{deferredResponse=resolve;});
   return route.fulfill(json(readiness));
  }
  return route.fulfill(json({message:"Access denied",code:"42501"},403));
 }
 if(path.startsWith("/rest/v1/rpc/"))return route.fulfill(json({message:"Forbidden",code:"42501"},403));
 return route.fulfill(json(single?null:[]));
});
try{
 const page=await context.newPage();
 page.on("pageerror",error=>pageErrors.push(error.message));
 await page.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await page.getByPlaceholder("Adresse e-mail").fill(user.email);
 await page.getByPlaceholder("Mot de passe",{exact:true}).fill("Mock-password-2026!");
 await page.getByRole("button",{name:"Se connecter",exact:true}).click();
 await page.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});
 await page.goto(base+"/gestion-independants",{waitUntil:"domcontentloaded"});
 const section=page.locator('[aria-label="Audit P0 de lancement BPEI"]');
 await section.waitFor({timeout:15000});
 const success="Toutes les preuves du tableau sont réunies";
 await section.getByText(success,{exact:false}).waitFor({timeout:15000});
 const refresh=section.getByRole("button",{name:"Actualiser les contrôles"});
 await refresh.click();
 await section.getByText(/Tableau P0 inaccessible/).waitFor({timeout:12000});
 assert.equal(await section.getByText(success,{exact:false}).count(),0,
  "Readiness failure must clear previously displayed positive status");
 // Two reads in reverse order: an older success cannot resurrect a denied refresh.
 await refresh.click(); // third response deliberately held
 await arrived;
 await refresh.click(); // fourth response denied immediately
 await section.getByText(/Tableau P0 inaccessible/).waitFor({timeout:12000});
 deferredResponse();
 await page.waitForTimeout(300);
 assert.equal(await section.getByText(success,{exact:false}).count(),0,
  "stale readiness response resurrected a prior approved status");
 assert.equal(readinessReads,4);
 assert.deepEqual(pageErrors,[]);
 console.log(JSON.stringify({ok:true,mode:"mocked-p0-readiness-recheck",readinessReads,staleStatusVisible:false}));
}finally{
 deferredResponse?.();
 await context.close();
 await browser.close();
}
