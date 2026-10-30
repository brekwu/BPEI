/**
 * Build a redirect only to a fixed path on the current BPEI origin.
 * The matching HTTPS URL still needs to be allowlisted in Supabase Auth.
 */
function checkedBpeiAuthOrigin(origin:string):URL{
 const url=new URL(origin);
 const local=["localhost","127.0.0.1","[::1]"].includes(url.hostname);
 if(url.username||url.password||url.pathname!=="/"||url.search||url.hash
    ||(url.protocol!=="https:" && !(local&&url.protocol==="http:"))
    ||!url.hostname)throw new Error("Untrusted BPEI authentication redirect origin");
 return url;
}

/**
 * An ephemeral Vercel deployment is not a dependable Auth allowlist entry:
 * choose a fixed first-party callback host for preview verification emails.
 * Config is build-time only, never read from a query string or user input.
 * This is NOT proof that the origin has been allowlisted in Supabase Auth.
 */
export function bpeiAuthRedirect(
 origin:string,
 route:"/espace-independant"|"/reinitialiser-mot-de-passe",
 configuredOrigin?:string,
):string{
 const current=checkedBpeiAuthOrigin(origin);
 if(!configuredOrigin?.trim())return new URL(route,current.origin).toString();
 const configured=checkedBpeiAuthOrigin(configuredOrigin);
 if(!["https://bpei-preview.vercel.app","https://bpei.fr","https://www.bpei.fr"].includes(configured.origin))
  throw new Error("BPEI Auth callback host is not a verified first-party origin");
 return new URL(route,configured.origin).toString();
}

/**
 * An unrelated PKCE code query param is not necessarily a recovery link.
 * The SDK PASSWORD_RECOVERY event is the authority for code-only callbacks.
 */
export function isExplicitBpeiRecoveryLink(search:string,hash:string):boolean{
 const query=new URLSearchParams(search.replace(/^\?/,""));
 const fragments=new URLSearchParams(hash.replace(/^#/,""));
 return query.get("type")==="recovery"||fragments.get("type")==="recovery";
}

/**
 * Restore a valid implicit recovery URL only if Supabase's current session
 * contains the exact access token supplied by that recovery email link.
 * An unrelated signed-in user plus ?type=recovery does not qualify.
 */
export function isMatchingBpeiImplicitRecoverySession(hash:string,sessionToken:string|null|undefined):boolean{
 const fragments=new URLSearchParams(hash.replace(/^#/,""));
 const token=fragments.get("access_token");
 return fragments.get("type")==="recovery"
   && !!fragments.get("refresh_token")
   && !!token
   && !!sessionToken
   && sessionToken===token;
}
