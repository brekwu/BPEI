import assert from "node:assert/strict";
import {chromium} from "playwright";

/**
 * Prelaunch auth contract only; deliberately does not create accounts or send email.
 * All responses come from a local route mock, not real Supabase Auth.
 */
const browser=await chromium.launch({headless:true});
const base=process.env.BPEI_SMOKE_ORIGIN||"http://127.0.0.1:3000";
const errors=[];
let signupCalls=0;
let recoverCalls=0;
const json=(data,status=200)=>({status,contentType:"application/json",body:JSON.stringify(data)});
const context=await browser.newContext();
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request();
 const pathname=new URL(req.url()).pathname;
 if(pathname.startsWith("/auth/v1/signup")){
  signupCalls++;return route.fulfill(json({message:"Registrations are locked"},403));
 }
 if(pathname.startsWith("/auth/v1/recover")){
  recoverCalls++;return route.fulfill(json({message:"Email service unavailable"},503));
 }
 if(pathname.startsWith("/auth/v1/"))return route.fulfill(json({code:"unauthenticated",message:"No session"},401));
 if(pathname.includes("/rest/v1/bpei_launch_controls"))
  return route.fulfill(json({
   id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null
  }));
 const single=(req.headers().accept||"").includes("application/vnd.pgrst.object+json");
 return route.fulfill(json(single?null:[]));
});
try{
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 let response=await page.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 assert.equal(response?.status(),200);
 await page.getByRole("button",{name:"Créer un compte"}).click();
 await page.getByRole("button",{name:"Créer mon compte"}).waitFor({timeout:12000});
 assert.equal(await page.getByRole("button",{name:"Créer mon compte"}).isDisabled(),true,
  "Closed legal/registration gates must disable the sign-up action");
 assert.equal(signupCalls,0,"Closed public gate must not invoke Supabase signup");
 await page.getByRole("button",{name:"Se connecter",exact:true}).click();
 await page.getByPlaceholder("Adresse e-mail").fill("existing@example.test");
 await page.getByPlaceholder("Mot de passe",{exact:true}).fill("Wrong-password-2026!");
 await page.getByRole("button",{name:"Se connecter",exact:true}).click();
 await page.getByText(/Connexion impossible. Vérifiez vos identifiants/).waitFor({timeout:12000});
 assert.equal(await page.getByRole("button",{name:"Se connecter",exact:true}).isEnabled(),true,
   "Login failure must not leave the sign-in form locked");
 response=await page.goto(base+"/reinitialiser-mot-de-passe",{waitUntil:"domcontentloaded"});
 assert.equal(response?.status(),200);
 await page.getByLabel("Adresse e-mail du compte").fill("existing@example.test");
 await page.getByRole("button",{name:"Recevoir un lien de réinitialisation"}).click();
 await page.getByRole("alert").waitFor({timeout:12000});
 const errorMessage=await page.getByRole("alert").innerText();
 assert.match(errorMessage,/La demande n'a pas pu être envoyée|Service temporairement indisponible/,
   "Recovery failure must be communicated without claiming a successful email");
 assert.equal(recoverCalls,1,"Browser must call the mocked recovery endpoint exactly once");
 assert.equal(await page.getByRole("button",{name:"Recevoir un lien de réinitialisation"}).isEnabled(),true,
  "Temporary email failure must not leave the form locked");
 assert.deepEqual(errors,[],"No uncaught errors on closed Auth paths");
 console.log(JSON.stringify({ok:true,mode:"mocked-prelaunch-auth",signupCalls,recoverCalls}));
}finally{
 await context.close();await browser.close();
}
