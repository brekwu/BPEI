// One-time customer-held review invitation. No fake reviews, no public access to source data.
import {createClient} from "npm:@supabase/supabase-js@2";
const reply=(status:number,body:unknown,origin="")=>new Response(JSON.stringify(body),{
 status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",
 ...(origin?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{})}
});
Deno.serve(async req=>{
 const target=Deno.env.get("BPEI_REVIEWS_ORIGIN")??"";
 let origin="";
 try{
  const u=new URL(target);
  if(u.protocol==="https:"&&u.pathname==="/"&&!u.search&&!u.hash&&!u.username&&!u.password)
   origin=u.origin;
 }catch{/* closed by default */}
 const incoming=req.headers.get("Origin");
 if(req.method==="OPTIONS"){
  if(origin&&incoming===origin)
   return new Response(null,{status:204,headers:{
    "Access-Control-Allow-Origin":origin,
    "Access-Control-Allow-Methods":"POST,OPTIONS",
    "Access-Control-Allow-Headers":"apikey,content-type,x-client-info,authorization",
    "Vary":"Origin"
   }});
  return reply(403,{error:"origin_denied"});
 }
 if(req.method!=="POST")return reply(405,{error:"method_not_allowed"});
 if(incoming&&incoming!==origin)return reply(403,{error:"origin_denied"});
 if(Deno.env.get("BPEI_REVIEWS_ENABLED")!=="true"||!origin)
  return reply(503,{error:"reviews_closed"},origin);
 const url=Deno.env.get("SUPABASE_URL")??"";
 const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
 if(!url.startsWith("https://")||!secret)return reply(503,{error:"server_unconfigured"},origin);
 if(Number(req.headers.get("Content-Length")??0)>8192)
  return reply(413,{error:"feedback_too_large"},origin);
 let payload:any;
 try{payload=await req.json()}catch{return reply(400,{error:"invalid_json"},origin)}
 const token=payload?.token;
 const rating=payload?.rating;
 const comment=payload?.comment;
 const consent=payload?.public_consent;
 if(typeof token!=="string"||!/^[a-f0-9]{64}$/.test(token)
  ||!Number.isInteger(rating)||rating<1||rating>5
  ||typeof comment!=="string"||comment.trim().length<20||comment.trim().length>1000
  ||typeof consent!=="boolean")
  return reply(400,{error:"invalid_feedback"},origin);
 try{
  const bytes=new TextEncoder().encode(token);
  const sum=await crypto.subtle.digest("SHA-256",bytes);
  const hash=[...new Uint8Array(sum)].map(v=>v.toString(16).padStart(2,"0")).join("");
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc("submit_customer_review",{
   p_token_sha256:hash,p_rating:rating,p_comment:comment.trim(),p_public_consent:consent
  });
  if(error||data!==true)return reply(409,{error:"invitation_invalid_used_or_expired"},origin);
  return reply(200,{status:"received_pending_moderation"},origin);
 }catch{
  return reply(503,{error:"review_temporarily_unavailable"},origin);
 }
});
