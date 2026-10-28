/**
 * Isolated preloader for first-admin P0 tests. NO network calls are allowed.
 * Supabase URL and admin credentials below are synthetic, and all fetches
 * are intercepted before they leave this Node process.
 */
const scenario=process.env.BPEI_BOOTSTRAP_TEST_SCENARIO;
if(!scenario)throw new Error("P0 bootstrap test scenario required");
const project="https://qmbsfmcotnsxsvbigynz.supabase.co";
const userId="a0000000-0000-4000-8000-000000000099";
const email="p0-fixture-admin@example.invalid";
const events=[];
const confirmed="2026-10-28T12:00:00.000Z";
let marker=true;
const respond=(data,status=200)=>{
  const body=typeof data==="string"?data:JSON.stringify(data);
  return new Response(body,{status,headers:{"content-type":"application/json"}});
};
globalThis.fetch=async(input,options={})=>{
  const target=typeof input==="string"?input:input.url;
  const url=new URL(target);
  if(url.origin!==project)throw new Error("P0 MOCK BLOCKED NETWORK: "+url.origin);
  const method=(options.method||input?.method||"GET").toUpperCase();
  const path=url.pathname;
  const event=method+" "+path;
  events.push(event);
  if(path==="/auth/v1/admin/users"&&method==="POST"){
    if(scenario==="create-error")return respond({message:"Mock Auth creation denied"},403);
    return respond({id:userId,email,email_confirmed_at:confirmed,app_metadata:{provider:"email",bpei_admin_bootstrap:true}});
  }
  if(path==="/rest/v1/independent_admins"&&method==="POST"){
    if(scenario==="grant-error")return respond({message:"Mock grant denied",code:"42501"},403);
    return new Response(null,{status:201,headers:{"content-type":"application/json"}});
  }
  if(path==="/rest/v1/independent_admins"&&method==="GET"){
    if(scenario==="verify-error")return respond({message:"Mock verification denied",code:"PGRST116"},406);
    return respond({user_id:userId});
  }
  if(path==="/auth/v1/admin/users/"+userId&&method==="GET"){
    return respond({id:userId,email:scenario==="resume-wrong-email"?"another@example.invalid":email,
      email_confirmed_at:scenario==="resume-unconfirmed"?null:confirmed,
      app_metadata:{provider:"email",...(marker?{bpei_admin_bootstrap:true}:{})}});
  }
  if(path==="/auth/v1/admin/users/"+userId&&method==="PUT"){
    if(scenario==="cleanup-error")return respond({message:"Mock marker cleanup failed"},500);
    marker=false;
    return respond({id:userId,email,email_confirmed_at:confirmed,app_metadata:{provider:"email"}});
  }
  throw new Error("P0 MOCK: unexpected Supabase call "+event);
};
process.on("exit",()=>process.stderr.write("\n@@P0_MOCK@@"+JSON.stringify({scenario,events,marker})+"\n"));
