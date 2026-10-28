import assert from "node:assert/strict";
import {chromium} from "playwright";

/**
 * Browser UI contract only: mocked auth and RPC; does not validate real Auth, RLS
 * or the mission search function against a populated Supabase database.
 */
const browser=await chromium.launch({headless:true});
const base=process.env.BPEI_SMOKE_ORIGIN||"http://127.0.0.1:3000";
const id="41414141-4141-4141-8141-414141414141";
const user={
 id,email:"p1-admin@example.test",aud:"authenticated",role:"authenticated",
 app_metadata:{provider:"email",providers:["email"]},user_metadata:{}
};
const calls=[];
const escalationCalls=[];
const incidentId="b0000000-0000-4000-8000-000000000001";
const errors=[];
const ok=(data,status=200)=>({status,contentType:"application/json",body:JSON.stringify(data)});
const summary={
 all_count:26,new_count:10,accepted_count:4,in_progress_count:2,
 completed_count:9,cancelled_count:1,attention_count:3
};
function fakeMission(index){
 return {
  id:"a0000000-0000-4000-8000-"+String(index+1).padStart(12,"0"),
  title:"Dépannage réseau "+(index+1),status:index<10?"new":"completed",
  created_at:"2026-10-28T12:00:00Z",scheduled_at:null,
  independent_id:id,technician_name:"Technicien P1",technician_city:"Nice",
  attention_reason:index===0?"awaiting_reply":null,active_incidents:0
 };
}
const context=await browser.newContext();
await context.route("https://placeholder.supabase.co/**",async route=>{
 const req=route.request(),url=new URL(req.url()),p=url.pathname;
 if(p.startsWith("/auth/v1/token")) return route.fulfill(ok({
  access_token:"mock.admin.access.token",token_type:"bearer",
  expires_in:3600,refresh_token:"mock.admin.refresh.token",user
 }));
 if(p==="/auth/v1/user")return route.fulfill(ok(user));
 if(p.startsWith("/auth/v1/"))return route.fulfill(ok({error:"unauthenticated"},401));
 if(p.includes("/rest/v1/bpei_launch_controls"))return route.fulfill(ok({
  id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null
 }));
 if(p.includes("/rest/v1/independent_admins")){
   const single=(req.headers().accept||"").includes("application/vnd.pgrst.object+json");
   return route.fulfill(ok(single?{user_id:id}:[{user_id:id}]));
 }
 if(p.includes("/rest/v1/bpei_mission_incidents")){
   return route.fulfill({
    status:200,contentType:"application/json",headers:{"content-range":"0-0/1"},
    body:JSON.stringify([{
      id:incidentId,request_id:"a0000000-0000-4000-8000-000000000001",
      category:"technical",description:"La connexion réseau du client est interrompue.",
      status:"open",resolution_note:null,priority:"normal",assigned_admin_id:null,
      target_at:"2026-10-29T12:00:00Z",created_at:"2026-10-28T12:00:00Z",escalation_reason:null
    }])
   });
 }
 if(p.includes("/rest/v1/bpei_incident_events"))return route.fulfill(ok([]));
 if(p.includes("/rest/v1/bpei_notifications"))return route.fulfill(ok([]));
 if(p.includes("/rest/v1/rpc/manage_incident_escalation")){
   escalationCalls.push(req.postDataJSON());
   return route.fulfill(ok({id:incidentId,status:"open",priority:"high",assigned_admin_id:id}));
 }
 if(p.includes("/rest/v1/rpc/bpei_admin_search_missions")){
  const params=req.postDataJSON();
  calls.push(params);
  const offset=params.p_offset??0,limit=params.p_limit??25;
  const filtered=params.p_attention==="needs_attention"||params.p_status==="accepted"||params.p_query;
  const total=filtered?1:26;
  const items=Array.from({length:Math.max(0,Math.min(limit,total-offset))},(_,i)=>fakeMission(i+offset));
  return route.fulfill(ok({items,total,summary}));
 }
 const single=(req.headers().accept||"").includes("application/vnd.pgrst.object+json");
 return route.fulfill(ok(single?null:[]));
});
try{
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.message));
 const start=await page.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 assert.equal(start?.status(),200);
 await page.getByPlaceholder("Adresse e-mail").fill(user.email);
 await page.getByPlaceholder("Mot de passe",{exact:true}).fill("Mock-password-2026!");
 await page.getByRole("button",{name:"Se connecter",exact:true}).click();
 await page.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});
 const response=await page.goto(base+"/gestion-missions",{waitUntil:"domcontentloaded"});
 assert.equal(response?.status(),200);
 await page.getByRole("heading",{name:"Gestion des missions BPEI"}).waitFor();
 await page.getByText("Dépannage réseau 1").first().waitFor({timeout:15000});
 assert.equal(calls.at(-1)?.p_limit,25);
 assert.equal(calls.at(-1)?.p_offset,0);
 await page.getByRole("button",{name:"Suivant"}).click();
 await page.getByText("page 2 sur 2").waitFor({timeout:15000});
 assert.equal(calls.at(-1)?.p_offset,25,"Second page must be queried on server");
 await page.getByRole("button",{name:/Afficher les dossiers à surveiller/}).click();
 await page.getByText("page 1 sur 1").waitFor({timeout:15000});
 assert.equal(calls.at(-1)?.p_attention,"needs_attention");
 assert.equal(calls.at(-1)?.p_offset,0,"Attention filter resets pagination");
 await page.getByRole("button",{name:/Afficher tous les dossiers/}).click();
 await page.getByLabel("Titre de mission ou nom du technicien").fill("réseau");
 await page.getByRole("button",{name:"Rechercher"}).click();
 await page.getByText("page 1 sur 1").waitFor({timeout:15000});
 assert.equal(calls.at(-1)?.p_query,"réseau","Search must execute in RPC, not client-only filtering");
 const incidentRoute=await page.goto(base+"/gestion-incidents",{waitUntil:"domcontentloaded"});
 assert.equal(incidentRoute?.status(),200);
 await page.getByRole("heading",{name:"Suivi des incidents BPEI"}).waitFor();
 await page.getByText("Priorité : Normale").waitFor({timeout:15000});
 await page.getByLabel("Priorité",{exact:true}).selectOption("high");
 await page.getByLabel(/Justification de l.escalade/).fill("Incident client prioritaire, risque de retard confirmé.");
 await page.getByRole("button",{name:"Enregistrer la priorité"}).click();
 await page.getByRole("button",{name:"Enregistrer la priorité"}).waitFor({state:"visible"});
 assert.equal(escalationCalls[0]?.p_action,"priority");
 assert.equal(escalationCalls[0]?.p_priority,"high");
 await page.getByLabel("Administrateur responsable").selectOption(id);
 await page.getByRole("button",{name:"Affecter",exact:true}).click();
 await page.getByRole("button",{name:"Affecter",exact:true}).waitFor({state:"visible"});
 assert.equal(escalationCalls[1]?.p_action,"assign");
 assert.equal(escalationCalls[1]?.p_assigned_admin_id,id);
 assert.deepEqual(errors,[],"No uncaught JS errors in mocked admin board and incident escalations");
 console.log(JSON.stringify({ok:true,mode:"mocked-admin-rpc",requests:calls.length,escalations:escalationCalls.length,errors:errors.length}));
}finally{
 await browser.close();
}
