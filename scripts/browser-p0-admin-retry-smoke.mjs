import assert from "node:assert/strict";
import {chromium} from "playwright";

const base=process.env.BPEI_SMOKE_ORIGIN||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true});
const userId="b0000000-0000-4000-8000-000000000019";
const user={id:userId,email:"bpei-test-admin@example.invalid",aud:"authenticated",
 role:"authenticated",app_metadata:{provider:"email",providers:["email"]},
 user_metadata:{},email_confirmed_at:"2026-10-28T10:00:00Z"};
const json=(obj,status=200)=>({status,contentType:"application/json",body:JSON.stringify(obj)});
const errors=[];
let rosterRequests=0;
const context=await browser.newContext();
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const singular=(req.headers().accept||"").includes("application/vnd.pgrst.object+json");
 if(path==="/auth/v1/token"){
  return route.fulfill(json({user,access_token:"mock.admin.token",refresh_token:"mock-refresh",
    expires_in:3600,token_type:"bearer"}));
 }
 if(path==="/auth/v1/user")return route.fulfill(json(user));
 if(path.startsWith("/auth/v1/"))return route.fulfill(json({message:"No session"},401));
 if(path==="/rest/v1/bpei_launch_controls")return route.fulfill(json({
  id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null}));
 if(path==="/rest/v1/independent_admins"){
  rosterRequests++;
  if(rosterRequests===1)return route.fulfill(json({message:"Temporary network failure",code:"503"},503));
  return route.fulfill(json({user_id:userId}));
 }
 return route.fulfill(json(singular?null:[]));
});
try{
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await page.getByPlaceholder("Adresse e-mail").fill(user.email);
 await page.getByPlaceholder("Mot de passe",{exact:true}).fill("P0-test-password!");
 await page.getByRole("button",{name:"Se connecter",exact:true}).click();
 await page.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});
 await page.goto(base+"/gestion-independants",{waitUntil:"domcontentloaded"});
 const retry=page.getByRole("button",{name:"Réessayer"});
 await retry.waitFor({timeout:15000});
 assert.equal(await page.getByText(/Impossible de vérifier les droits administrateur/).count(),1);
 assert.equal(await page.getByRole("heading",{name:/Candidatures \(/}).count(),0,
  "Admin data must stay hidden when permission lookup fails");
 await retry.click();
 await page.getByRole("heading",{name:"Candidatures (0)"}).waitFor({timeout:15000});
 assert.equal(rosterRequests,2,"Permission check must be retried exactly once");
 assert.deepEqual(errors,[],"No unhandled browser errors");
 console.log(JSON.stringify({ok:true,mode:"mocked-admin-network-recovery",rosterRequests}));
}finally{await context.close();await browser.close();}
