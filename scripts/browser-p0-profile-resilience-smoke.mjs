import assert from "node:assert/strict";
import { chromium } from "playwright";

/**
 * P0 browser recovery regression with a simulated external service.
 * Never creates real users, legal releases, profiles or applications.
 */
const base=process.env.BPEI_SMOKE_ORIGIN||"http://127.0.0.1:3000";
const browser=await chromium.launch({headless:true});
const id="88888888-8888-4888-8888-888888888888";
const user={id,email:"authorized-test@example.invalid",aud:"authenticated",role:"authenticated",
 app_metadata:{provider:"email",providers:["email"]},user_metadata:{},email_confirmed_at:"2026-10-28T11:00:00Z"};
let consentAttempts=0,profileAttempts=0,profileReadAttempts=0,profile=null,accepted=false;
const errors=[];
const json=(data,status=200)=>({status,contentType:"application/json",body:JSON.stringify(data)});
const context=await browser.newContext();
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method();
 if(path==="/auth/v1/token")return route.fulfill(json({
  user,access_token:"mock.token.signature",refresh_token:"mock-refresh",
  expires_in:3600,token_type:"bearer"
 }));
 if(path==="/auth/v1/user")return route.fulfill(json(user));
 if(path.startsWith("/auth/v1/"))return route.fulfill(json({message:"Unauthorized"},401));
 const single=(req.headers().accept||"").includes("application/vnd.pgrst.object+json");
 if(path==="/rest/v1/bpei_launch_controls")
  return route.fulfill(json({legal_documents_published:true,independent_registration_enabled:false,
   legal_version:"bpei-test-v1"}));
 if(path==="/rest/v1/independent_profiles"){
  if(method==="GET"&&++profileReadAttempts===1){
   return route.fulfill(json({message:"Simulated profile fetch failure",code:"503"},503));
  }
  if(method==="POST"){
   profileAttempts++;
   if(profileAttempts===1)return route.fulfill(json({message:"Temporary outage",code:"503"},503));
   profile={user_id:id,display_name:"Technicien de recette",business_name:null,
    siret:null,city:null,postal_code:null,service_radius_km:null,bio:null,skills:[],verified_at:null};
   return route.fulfill({status:201,body:"",headers:{"content-type":"application/json"}});
  }
  return route.fulfill(json(single?profile:profile?[profile]:[]));
 }
 if(path==="/rest/v1/bpei_legal_acceptances"){
  if(method==="POST"){
   consentAttempts++;
   if(consentAttempts===1)return route.fulfill(json({message:"Temporary outage",code:"503"},503));
   accepted=true;return route.fulfill({status:201,body:"",headers:{"content-type":"application/json"}});
  }
  return route.fulfill(json(single?(accepted?{legal_version:"bpei-test-v1"}:null):
    (accepted?[{legal_version:"bpei-test-v1"}]:[])));
 }
 if(path==="/rest/v1/independent_applications")return route.fulfill(json(single?null:[]));
 if(path==="/rest/v1/independent_requests")return route.fulfill(json([]));
 return route.fulfill(json(single?null:[]));
});
try{
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 const start=await page.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 assert.equal(start?.status(),200);
 await page.getByPlaceholder("Adresse e-mail").fill(user.email);
 await page.getByPlaceholder("Mot de passe",{exact:true}).fill("Test-password-2026!");
 await page.getByRole("button",{name:"Se connecter",exact:true}).click();
 await page.getByText("Impossible de récupérer votre espace. Réessayez ultérieurement.").waitFor({timeout:15000});
 assert.equal(await page.getByRole("button",{name:"Créer mon profil"}).count(),0,
  "Failed private data read must not allow mutation using partial state");
 await page.getByRole("button",{name:"Actualiser mon espace"}).click();
 await page.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});
 assert.ok(profileReadAttempts>=2,"Recovery must re-fetch profile after initial failure");
 // Signed-in users must not be able to treat arbitrary ?type=recovery as a valid recovery.
 await page.goto(base+"/reinitialiser-mot-de-passe?type=recovery",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Recevoir un lien de réinitialisation"}).waitFor({timeout:15000});
 assert.equal(await page.getByRole("button",{name:"Enregistrer le mot de passe"}).count(),0,
   "Existing session must not authorize an unverified password recovery link");
 await page.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await page.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});
 const check=page.getByRole("checkbox",{name:/J'ai pris connaissance de ces documents/});
 await check.check();
 const consent=page.getByRole("button",{name:"Enregistrer mon acceptation"});
 await consent.click();
 await page.getByText("Acceptation non enregistrée. Réessayez.").waitFor({timeout:15000});
 assert.equal(await consent.isEnabled(),true,"Failed consent must become retryable");
 await consent.click();
 await page.getByRole("button",{name:"Créer mon profil"}).waitFor({timeout:15000});
 const name=page.getByRole("textbox",{name:"Nom professionnel"});
 await name.fill("Technicien de recette");
 const create=page.getByRole("button",{name:"Créer mon profil"});
 await create.click();
 await page.getByText("La création du profil a échoué.").waitFor({timeout:15000});
 assert.equal(await create.isEnabled(),true,"Failed profile insert must become retryable");
 await create.click();
 await page.getByRole("textbox",{name:"Nom affiché"}).waitFor({timeout:15000});
 assert.equal(consentAttempts,2);
 assert.equal(profileAttempts,2);
 assert.deepEqual(errors,[],"No uncaught errors during network failure retries");
 console.log(JSON.stringify({ok:true,mode:"mocked-p0-resilience",consentAttempts,profileAttempts}));
}finally{
 await context.close();await browser.close();
}
