import {createFileRoute} from "@tanstack/react-router";
import {bpeiSupabaseDependencyAvailable} from "@/lib/bpei-dependency-health";

/**
 * Separate from /health (liveness). 503 means the server cannot currently read
 * the configured Supabase public launch-control record.
 * 200 means the dependency works, NOT that BPEI is open for business.
 */
export const Route=createFileRoute("/health/dependencies")({
 server:{handlers:{
  GET:async ()=>{
   const reachable=await bpeiSupabaseDependencyAvailable({
    url:process.env.SUPABASE_URL,
    publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY
   });
   return new Response(JSON.stringify({
    status:reachable?"ok":"unavailable",scope:"dependency_only"
   }),{
    status:reachable?200:503,
    headers:{"Content-Type":"application/json; charset=utf-8",
     "Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff"}
   });
  }
 }},
 component:()=>null
});
