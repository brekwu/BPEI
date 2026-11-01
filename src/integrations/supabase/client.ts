import { createClient } from "@supabase/supabase-js";
function createBpeiClient(){
 const url=import.meta.env.VITE_SUPABASE_URL || (typeof process!=="undefined" ? process.env.SUPABASE_URL : undefined);
 const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (typeof process!=="undefined" ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined);
 if(!url||!key) throw new Error("Supabase BPEI non configuré");
 const safeFetch:typeof fetch=(input,init)=>{
  const headers=new Headers(typeof Request!=="undefined" && input instanceof Request? input.headers:undefined);
  if(init?.headers)new Headers(init.headers).forEach((v,k)=>headers.set(k,v));
  if(key.startsWith("sb_") && headers.get("Authorization")==="Bearer "+key) headers.delete("Authorization");
  headers.set("apikey",key);
  return fetch(input,{...init,headers});
 };
 return createClient(url,key,{global:{fetch:safeFetch},auth:{persistSession:typeof window!=="undefined",autoRefreshToken:typeof window!=="undefined"}});
}
let instance:ReturnType<typeof createBpeiClient>|undefined;
export const supabase=new Proxy({} as ReturnType<typeof createBpeiClient>,{
 get(_,prop,receiver){if(!instance)instance=createBpeiClient();return Reflect.get(instance,prop,receiver)}
});
