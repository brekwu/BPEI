import {stubMockInboxNotifications} from "./mock-hidden-inbox-notifications.mjs";
import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

/**
 * P0 browser regression with entirely mocked Supabase responses.
 * No real customer information, accounts, missions or paid transactions.
 */
const engine=process.env.BPEI_BROWSER_ENGINE??"chromium";
assert.ok(["chromium","webkit"].includes(engine));
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const context=await browser.newContext();
await stubMockInboxNotifications(context);
const base=process.env.BPEI_SMOKE_ORIGIN??"http://127.0.0.1:3000";
const id="99999999-9999-4999-8999-999999999999";
const techId="88888888-8888-4888-8888-888888888888";
const inquiryId="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const user={id,email:"admin-retry-p0@example.invalid",role:"authenticated",aud:"authenticated",
 email_confirmed_at:"2026-10-28T10:00:00Z",user_metadata:{},
 app_metadata:{provider:"email",providers:["email"]}};
const inquiry={id:inquiryId,kind:"intervention",client_name:"Client sensible de test",
 email:"private-inquiry@example.invalid",phone:"0611223344",city:"Nice",
 address_line1:"12 rue fictive",postal_code:"06000",customer_kind:"individual",
 company_name:null,company_siret:null,subject:"PC en panne",
 description:"Demande fictive de dépannage informatique",status:"new",
 created_at:"2026-10-29T12:00:00Z",assigned_to:null};
let failAllReads=false;
let failedReadCount=0;
let assignCalls=0;
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
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),u=new URL(req.url()),p=u.pathname;
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
  access_token:"mock-inquiry-retry.token.signature",refresh_token:"mock-inquiry-retry-refresh",
  expires_in:3600,token_type:"bearer"}));
 if(p==="/auth/v1/user")return route.fulfill(json(user));
 if(p==="/auth/v1/logout")return route.fulfill({status:204,body:""});
 if(p.startsWith("/auth/v1/"))return route.fulfill(json({message:"No session"},401));
 if(p==="/rest/v1/independent_admins")return route.fulfill(json(single?{user_id:id}:[{user_id:id}]));
 if(p==="/rest/v1/bpei_launch_controls")return route.fulfill(json({
  id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null
 }));
 if(p==="/rest/v1/bpei_inquiries"){
  if(failAllReads){failedReadCount+=1;return route.fulfill(json({code:"PGRST301",message:"Temporary read denied"},403));}
  return route.fulfill(json(single?inquiry:[inquiry]));
 }
 if(p==="/rest/v1/independent_profiles"){
  const rows=[{user_id:techId,display_name:"Technicien fictif",city:"Nice",
   verified_at:"2026-10-28T09:00:00Z",siret:"12345678901234"}];
  return route.fulfill(json(single?null:rows));
 }
 if(p==="/rest/v1/independent_applications")
  return route.fulfill(json(single?null:[{user_id:techId,status:"approved",
   id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",created_at:"2026-10-29T08:00:00Z",
   reviewed_at:null,message:"Candidature fictive"}]));
 if(p==="/rest/v1/independent_requests")
  return route.fulfill(json([]));
 if(p==="/rest/v1/rpc/assign_bpei_inquiry"){
  assignCalls+=1;
  if(assignCalls===1)return route.fulfill(json({message:"Connection interrupted"},503));
  inquiry.status="assigned";inquiry.assigned_to=techId;
  return route.fulfill(json(true));
 }
 if(p.startsWith("/rest/v1/rpc/"))return route.fulfill(json({message:"Not configured"},403));
 return route.fulfill(json(single?null:[]));
});
try{
 const login=await context.newPage();login.on("pageerror",e=>errors.push(e.message));
 await login.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await login.getByPlaceholder("Adresse e-mail").fill(user.email);
 await login.getByPlaceholder("Mot de passe",{exact:true}).fill("Mock-password-2026!");
 await login.getByRole("button",{name:"Se connecter",exact:true}).click();
 await login.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});

 const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
 page.on("dialog",dialog=>dialog.accept());
 await page.goto(base+"/gestion-independants",{waitUntil:"domcontentloaded"});
 const section=page.locator('section[aria-label="Demandes clients"]');
 await section.getByText("Client sensible de test",{exact:false}).waitFor({timeout:15000});

 // First simulated provider outage hides all previously loaded personal details.
 failAllReads=true;
 await section.getByRole("button",{name:"Actualiser"}).click();
 await section.getByText("La lecture des demandes et des indépendants a échoué.",{exact:false}).waitFor({timeout:15000});
 assert.ok(failedReadCount>=1,"The simulated provider denied at least one request");
 assert.equal(await section.getByText("Client sensible de test",{exact:false}).count(),0);
 assert.equal(await section.getByText("Aucun message ou demande d'intervention.").count(),0);

 // Restore the provider only after the failed read has been rendered.
 failAllReads=false;
 await section.getByRole("button",{name:"Actualiser"}).click();
 await section.getByText("Client sensible de test",{exact:false}).waitFor({timeout:15000});
 await section.locator('select[id^="tech-"]').selectOption(techId);
 const assign=section.getByRole("button",{name:"Attribuer"});
 await assign.click();
 await section.getByText("Attribution non confirmée.",{exact:false}).waitFor({timeout:15000});
 assert.equal(await assign.isEnabled(),true,"Failed assignment left the interface locked");
 assert.equal(assignCalls,1,"An uncertain RPC must never be retried automatically");

 // The operator intentionally reattempts, after checking the dossier.
 await assign.click();
 await section.getByText("Mission attribuée",{exact:false}).waitFor({timeout:15000});
 assert.equal(assignCalls,2);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,mode:"mocked-inquiries-retry",
  staleCustomerDetails:0,manualAssignmentAttempts:assignCalls}));
}finally{await context.close();await browser.close();}
