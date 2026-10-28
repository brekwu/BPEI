import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";

/**
 * Simulated P1 inbox contract: 45 rows, 35 unread, pagination, RPC retry,
 * and cross-tab sign-out. No real accounts or notifications are created.
 */
const engine=process.env.BPEI_BROWSER_ENGINE??"chromium";
assert.ok(["chromium","webkit"].includes(engine));
const browser=await (engine==="webkit"?webkit:chromium).launch({headless:true});
const base=process.env.BPEI_SMOKE_ORIGIN||"http://127.0.0.1:3000";
const id="88888888-7777-4777-8777-777777777777";
const user={id,email:"p1-inbox@example.invalid",role:"authenticated",aud:"authenticated",
 email_confirmed_at:"2026-10-28T10:00:00Z",user_metadata:{},
 app_metadata:{provider:"email",providers:["email"]}};
const notifications=Array.from({length:45},(_,i)=>({
 id:"e0000000-0000-4000-8000-"+String(i+1).padStart(12,"0"),
 recipient_id:id,title:"Notification "+String(i+1),
 created_at:new Date(Date.UTC(2026,9,28,10,0,i)).toISOString(),
 read_at:i>=10?null:"2026-10-28T11:00:00.000Z"
})).reverse();
let attempts=0,readCalls=0,countCalls=0;
const errors=[];
const context=await browser.newContext();
const json=(data,status=200,headers={})=>({
 status,contentType:"application/json",body:JSON.stringify(data),headers
});
await context.route("https://placeholder.supabase.co/**",async route=>{
 const request=route.request(),url=new URL(request.url());
 const path=url.pathname,method=request.method();
 const single=(request.headers().accept||"").includes("application/vnd.pgrst.object+json");
 if(path==="/auth/v1/token")return route.fulfill(json({
  user,access_token:"mock-p1-inbox.token.signature",refresh_token:"mock-inbox-refresh",
  expires_in:3600,token_type:"bearer"
 }));
 if(path==="/auth/v1/user")return route.fulfill(json(user));
 if(path==="/auth/v1/logout")return route.fulfill({status:204,body:""});
 if(path.startsWith("/auth/v1/"))return route.fulfill(json({message:"Unauthenticated"},401));
 if(path==="/rest/v1/bpei_launch_controls")return route.fulfill(json({
  id:true,legal_documents_published:false,independent_registration_enabled:false,legal_version:null
 }));
 if(path==="/rest/v1/independent_admins")
  return route.fulfill(json(single?{user_id:id}:[{user_id:id}]));
 if(path==="/rest/v1/rpc/bpei_admin_incident_statistics")return route.fulfill(json({
  total:0,open:0,under_review:0,resolved:0,unassigned:0,
  overdue:0,critical_active:0,low:0,normal:0,high:0,critical:0
 }));
 if(path==="/rest/v1/rpc/mark_bpei_notification_read"){
  attempts++;
  if(attempts===1)return route.fulfill(json({message:"Temporary interruption",code:"503"},503));
  const target=JSON.parse(request.postData()??"{}").p_notification_id;
  const match=notifications.find(n=>n.id===target);
  if(!match)return route.fulfill(json(false));
  match.read_at??="2026-10-28T11:05:00.000Z";
  return route.fulfill(json(true));
 }
 if(path==="/rest/v1/bpei_notifications"){
  const filtered=notifications.filter(n=>n.recipient_id===id &&
   (!url.searchParams.has("read_at")||!n.read_at));
  const countHeader={"content-range":"*/"+filtered.length,"access-control-expose-headers":"content-range"};
  if(method==="HEAD"){
   countCalls++;
   return route.fulfill({status:200,headers:countHeader});
  }
  readCalls++;
  const range=request.headers().range??"0-19";
  const match=range.match(/^(\d+)-(\d+)$/);
  const start=match?Number(match[1]):0;
  const end=match?Number(match[2]):filtered.length-1;
  const page=filtered.slice(start,end+1).map(({recipient_id,...item})=>item);
  return route.fulfill(json(page,200,{"content-range":start+"-"+Math.max(start,start+page.length-1)+"/"+filtered.length,"access-control-expose-headers":"content-range"}));
 }
 return route.fulfill(json(single?null:[]));
});
try{
 const login=await context.newPage();
 login.on("pageerror",e=>errors.push(e.message));
 await login.goto(base+"/espace-independant",{waitUntil:"domcontentloaded"});
 await login.getByPlaceholder("Adresse e-mail").fill(user.email);
 await login.getByPlaceholder("Mot de passe",{exact:true}).fill("Safe-password-2026!");
 await login.getByRole("button",{name:"Se connecter",exact:true}).click();
 await login.getByRole("heading",{name:"Mon profil",exact:true}).waitFor({timeout:15000});

 const inbox=await context.newPage();
 inbox.on("pageerror",e=>errors.push(e.message));
 await inbox.goto(base+"/gestion-incidents",{waitUntil:"domcontentloaded"});
 try {
  await inbox.getByRole("heading",{name:"Notifications (35 non lues)"}).waitFor({timeout:12000});
 } catch(error) {
  console.error("INBOX DIAGNOSTIC",JSON.stringify({
   rendered:await inbox.locator('section[aria-label="Notifications BPEI"]').allInnerTexts(),
   countCalls,readCalls,markAttempts:attempts,
   pageErrors:errors
  }));
  throw error;
 }
 await inbox.getByRole("button",{name:"Consulter"}).click();
 await inbox.getByText("Notifications 1–20 sur 45").waitFor({timeout:15000});
 assert.equal(await inbox.getByText("Notification 45",{exact:true}).count(),1);
 assert.equal(await inbox.getByText("Notification 25",{exact:true}).count(),0);
 try {
  await inbox.getByRole("button",{name:"Marquer lue"}).first().click({timeout:12000});
 } catch(error){
  console.error("INBOX MARK DIAGNOSTIC",JSON.stringify({
   rendered:await inbox.locator('section[aria-label="Notifications BPEI"]').allInnerTexts(),
   unreadButtonCount:await inbox.getByRole("button",{name:"Marquer lue"}).count(),
   readCalls,countCalls
  }));
  throw error;
 }
 await inbox.getByText("Impossible de marquer la notification comme lue.").waitFor({timeout:15000});
 assert.equal(await inbox.getByRole("heading",{name:"Notifications (35 non lues)"}).count(),1);
 await inbox.getByRole("button",{name:"Marquer lue"}).first().click();
 await inbox.getByRole("heading",{name:"Notifications (34 non lues)"}).waitFor({timeout:15000});
 await inbox.getByRole("button",{name:"Suivant"}).click();
 await inbox.getByText("Notifications 21–40 sur 45").waitFor({timeout:15000});
 assert.equal(await inbox.getByText("Notification 25",{exact:true}).count(),1);
 await inbox.getByRole("button",{name:"Suivant"}).click();
 await inbox.getByText("Notifications 41–45 sur 45").waitFor({timeout:15000});
 assert.equal(await inbox.getByText("Notification 1",{exact:true}).count(),1);
 assert.ok(countCalls>=3&&readCalls>=3,"Both count and paged database reads must run");
 assert.equal(attempts,2,"Retryable mark-read action must be issued exactly twice");
 await login.getByRole("button",{name:"Se déconnecter"}).click();
 await inbox.getByText("Accès administrateur non autorisé.").waitFor({timeout:15000});
 assert.equal(await inbox.getByText("Notification 1",{exact:true}).count(),0,
  "Private inbox content must be removed after sign-out from another tab");
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,mode:"mocked-p1-inbox",total:45,unreadStart:35,
  unreadAfterMark:34,pages:3,markAttempts:attempts,crossTabSignout:true}));
}finally{
 await context.close();await browser.close();
}
