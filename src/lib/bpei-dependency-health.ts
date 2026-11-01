/**
 * Technical availability probe for the real Supabase Data API.
 *
 * A healthy Supabase dependency does NOT mean BPEI is authorized to launch.
 * Never return the API key, the configured URL, legal status or a user record.
 */
type Requester = typeof fetch;

export async function bpeiSupabaseDependencyAvailable(
 config:{url:string|undefined;publishableKey:string|undefined},
 requester:Requester=fetch
):Promise<boolean>{
 const rawUrl=config.url?.trim()??"";
 const key=config.publishableKey?.trim()??"";
 let origin:string;
 try{
  const u=new URL(rawUrl);
  if(u.protocol!=="https:"||!u.hostname.endsWith(".supabase.co")
   ||u.hostname===".supabase.co"||u.username||u.password||u.port
   ||u.pathname!=="/"||u.search||u.hash)return false;
  origin=u.origin;
 }catch{return false;}
 // Never use an admin/service key or an arbitrary header token here.
 if(!key.startsWith("sb_publishable_") && !/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key))
  return false;
 try{
  const response=await requester(
   origin+"/rest/v1/bpei_launch_controls?select=id,legal_documents_published,independent_registration_enabled,legal_version&id=eq.true&limit=1",
   {method:"GET",headers:{apikey:key,accept:"application/json"},
    cache:"no-store",redirect:"error",signal:AbortSignal.timeout(3000)}
  );
  if(!response.ok)return false;
  const rows:unknown=await response.json();
  if(!Array.isArray(rows)||rows.length!==1)return false;
  const gate=rows[0];
  return !!gate&&gate.id===true
    &&typeof gate.legal_documents_published==="boolean"
    &&typeof gate.independent_registration_enabled==="boolean"
    &&(gate.legal_version===null||typeof gate.legal_version==="string");
 }catch{return false;}
}
