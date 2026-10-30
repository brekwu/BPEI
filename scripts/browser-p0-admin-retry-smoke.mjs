import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

/**
 * UI-only regression for the P0 admin retry action.
 * The first permission check fails transiently, the next one succeeds.
 * No real Supabase users, privileges, emails or other data are modified.
 */
const engine=process.env.BPEI_BROWSER_ENGINE ?? "chromium";
assert.ok(["chromium","webkit"].includes(engine));
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const base=process.env.BPEI_SMOKE_ORIGIN ?? "http://127.0.0.1:3000";
const user={id:"12345678-1234-4234-8234-123456789012",email:"admin-retry@example.invalid",
  role:"authenticated",aud:"authenticated",email_confirmed_at:"2026-10-28T10:00:00Z",
  app_metadata:{provider:"email",providers:["email"]},user_metadata:{}};
let adminChecks=0;
let grantPermission=false;
const errors=[];
// Safari/WebKit requires an explicit origin and a successful preflight even
// for mocked Supabase requests. This test uses no real external network.
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
 if(path==="/rest/v1/bpei_notifications"){
   // The inbox makes both GET list and HEAD exact-count requests.
   // Match PostgREST's count headers; never leak to the real network.
   return route.fulfill({
     status:200,
     headers:{...cors,"content-type":"application/json","content-range":"*/0"},
     body:req.method()==="HEAD"?"":"[]"
   });
  }
 
  if(path==="/auth/v1/token")return route.fulfill(json({user,access_token:"mock-p0-admin.token.signature",
    refresh_token:"mock-p0-admin-refresh",expires_in:3600,token_type:"bearer"}));
  if(path==="/auth/v1/user")return route.fulfill(json(user));
  if(path==="/auth/v1/logout")return route.fulfill({status:204,body:""});
  if(path.startsWith("/auth/v1/"))return route.fulfill(json({message:"No session"},401));
  if(path==="/rest/v1/independent_admins"){
    adminChecks+=1;
    if(!grantPermission)return route.fulfill(json({code:"PGRST503",message:"Temporary database failure"},503));
    return route.fulfill(json(single?{user_id:user.id}:[{user_id:user.id}]));
  }
  if(path==="/rest/v1/bpei_launch_controls")
    return route.fulfill(json({id:true,legal_documents_published:false,
      independent_registration_enabled:false,legal_version:null}));
  if(path.startsWith("/rest/v1/rpc/"))return route.fulfill(json({message:"Unavailable in mocked smoke"},403));
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
  await page.getByText("Accès administrateur non autorisé pour ce compte.").waitFor({timeout:15000});
  assert.ok(adminChecks>=1,"At least one admin permission check must have failed");
  const initialChecks=adminChecks;
  // Keep every initial Auth / onAuthStateChange permission read failing.
  // Allow access only AFTER the explicit user-facing Retry action.
  grantPermission=true;
  await page.getByRole("button",{name:"Réessayer"}).click();
  await page.getByRole("heading",{name:"Candidatures (0)"}).waitFor({timeout:15000});
  assert.ok(adminChecks>initialChecks,"Retry must query permissions again rather than reuse an earlier result");
  assert.deepEqual(errors,[],"Unexpected JavaScript errors");
  console.log(JSON.stringify({ok:true,mode:"mocked-admin-permission-retry",
    adminChecks,permissionEscalation:false}));
} finally{
  await context.close();
  await browser.close();
}
