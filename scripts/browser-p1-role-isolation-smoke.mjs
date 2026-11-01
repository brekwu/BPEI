import assert from "node:assert/strict";
import {chromium} from "playwright";

/**
 * Authenticated technician browser contract (mock API).
 * Database RLS was separately tested using rollback-only SQL fixtures.
 */
const browser=await chromium.launch({headless:true});
const base=process.env.BPEI_SMOKE_ORIGIN||"http://127.0.0.1:3000";
const id="77777777-7777-4777-8777-777777777777";
const user={id,email:"p1-technician@example.test",aud:"authenticated",
 role:"authenticated",app_metadata:{provider:"email",providers:["email"]},
 user_metadata:{}};
let adminCalls=0;
const errors=[];
const respond=(data,status=200)=>({status,contentType:"application/json",body:JSON.stringify(data)});
const context=await browser.newContext();
await context.route("https://placeholder.supabase.co/**",async route=>{
 const request=route.request(),path=new URL(request.url()).pathname;
 if(path.startsWith("/auth/v1/token"))return route.fulfill(respond({
  access_token:"mock-technician-token",token_type:"bearer",
  expires_in:3600,refresh_token:"mock-technician-refresh",user
 }));
 if(path==="/auth/v1/user")return route.fulfill(respond(user));
 if(path.startsWith("/auth/v1/"))return route.fulfill(respond({message:"Not signed in"},401));
 if(path.includes("/rest/v1/bpei_launch_controls"))return route.fulfill(respond({
  id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null
 }));
 if(path.includes("/rest/v1/independent_admins"))return route.fulfill(respond(null));
 if(path.includes("/rest/v1/rpc/bpei_admin_")||
    path.includes("/rest/v1/rpc/manage_incident_escalation")||
    path.includes("/rest/v1/rpc/review_bpei_incident")){
  adminCalls++;
  return route.fulfill(respond({message:"Not authorized"},403));
 }
 const single=(request.headers().accept||"").includes("application/vnd.pgrst.object+json");
 return route.fulfill(respond(single?null:[]));
});
try{
 const page=await context.newPage();
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await page.getByPlaceholder("Adresse e-mail").fill(user.email);
 await page.getByPlaceholder("Mot de passe",{exact:true}).fill("Demo-password-2026!");
 await page.getByRole("button",{name:"Se connecter",exact:true}).click();
 await page.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});
 for(const route of ["/gestion-incidents","/gestion-missions"]){
  const response=await page.goto(base+route,{waitUntil:"domcontentloaded"});
  assert.equal(response?.status(),200);
  await page.getByText("Accès administrateur non autorisé.").waitFor({timeout:15000});
  assert.equal(await page.getByRole("button",{name:"Exporter CSV"}).count(),0);
 }
 assert.equal(adminCalls,0,"Non-admin UI must not invoke admin RPCs");
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,mode:"simulated-technician",deniedRoutes:2,adminCalls}));
}finally{
 await context.close();
 await browser.close();
}
