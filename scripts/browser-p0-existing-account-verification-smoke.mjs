import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";
import {stubMockInboxNotifications} from "./mock-hidden-inbox-notifications.mjs";

/** No real Supabase users, email deliveries or admin rights are changed. */
const engine=process.env.BPEI_BROWSER_ENGINE??"chromium";
assert.ok(["chromium","webkit"].includes(engine));
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const base=process.env.BPEI_SMOKE_ORIGIN??"http://127.0.0.1:3000";
const email="unconfirmed-operator@example.invalid";
let otpCalls=0,signupCalls=0,tokenCalls=0;
const payloads=[],redirects=[],errors=[];
const cors={
 "access-control-allow-origin":new URL(base).origin,
 "access-control-allow-credentials":"true",
 "access-control-allow-methods":"GET,POST,PATCH,PUT,DELETE,OPTIONS",
 "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
 "access-control-expose-headers":"content-range,range",
 "vary":"Origin"
};
const json=(data,status=200)=>({status,contentType:"application/json",headers:cors,body:JSON.stringify(data)});
const context=await browser.newContext();
await stubMockInboxNotifications(context);
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname;
 if(req.method()==="OPTIONS")return route.fulfill({
  status:204,body:"",
  headers:{...cors,"access-control-allow-headers":
   req.headers()["access-control-request-headers"]??cors["access-control-allow-headers"]}
 });
 const single=(req.headers().accept??"").includes("application/vnd.pgrst.object+json");
 if(path==="/rest/v1/bpei_notifications")
  return route.fulfill({status:200,headers:{...cors,"content-type":"application/json","content-range":"*/0"},
   body:req.method()==="HEAD"?"":"[]"});
 if(path==="/rest/v1/bpei_launch_controls")return route.fulfill(json({
  id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null
 }));
 if(path==="/auth/v1/token"){
  tokenCalls++;
  return route.fulfill(json({code:"email_not_confirmed",error_code:"email_not_confirmed",msg:"Email not confirmed",message:"Email not confirmed"},400));
 }
 if(path==="/auth/v1/otp"){
  otpCalls++;
  payloads.push(req.postDataJSON());
  redirects.push(url.searchParams.get("redirect_to")??"");
  if(otpCalls===1)return route.fulfill(json({code:"email_service_unavailable",message:"SMTP not configured"},503));
  return route.fulfill(json({}));
 }
 if(path==="/auth/v1/signup"){signupCalls++;return route.fulfill(json({code:"signup_disabled",message:"Registration is closed"},403));}
 if(path.startsWith("/auth/v1/"))return route.fulfill(json({code:"unauthenticated",message:"No session"},401));
 return route.fulfill(json(single?null:[]));
});
try{
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await page.getByPlaceholder("Adresse e-mail").fill(email);
 await page.getByPlaceholder("Mot de passe",{exact:true}).fill("Strong-password-2026!");
 await page.getByRole("button",{name:"Se connecter",exact:true}).click();
 await page.getByText("Confirmez votre adresse e-mail pour vous connecter.",{exact:false}).waitFor({timeout:15000});
 const button=page.getByRole("button",{name:"Recevoir un lien de vérification du compte existant"});
 await button.waitFor({timeout:15000});
 await button.click();
 await page.getByText("Lien de vérification indisponible.",{exact:false}).waitFor({timeout:15000});
 assert.equal(await button.isEnabled(),true,"Email delivery failure must not lock verification link action");
 await button.click();
 await page.getByText("Si ce compte existe et que l'envoi d'e-mails fonctionne",{exact:false}).waitFor({timeout:15000});
 assert.equal(otpCalls,2);
 assert.equal(signupCalls,0,"Verification of an existing user must never call public signup");
 assert.equal(tokenCalls,1);
 for(const body of payloads){
  assert.equal(body.email,email);
  assert.equal(body.create_user,false,"Auth must NOT create user from magic link");
 }
 for(const redirect of redirects){
  assert.equal(new URL(redirect).pathname,"/espace-independant");
  assert.equal(new URL(redirect).origin,"https://bpei-preview.vercel.app",
   "The Auth email must not return to an ephemeral Vercel deployment");
 }
 assert.equal(await page.getByRole("heading",{name:"Mon profil"}).count(),0,
  "A successful OTP request does not establish login or administrator status");
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,mode:"mocked-existing-auth-email-verification",otpCalls,signupCalls,authenticated:false}));
}finally{
 await context.close();
 await browser.close();
}
