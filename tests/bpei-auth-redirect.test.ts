import test from "node:test";
import assert from "node:assert/strict";
import {bpeiAuthRedirect,isExplicitBpeiRecoveryLink} from "../src/lib/bpei-auth-redirect.ts";

test("auth redirect retains only the trusted origin and fixed route",()=>{
 assert.equal(bpeiAuthRedirect("https://bpei.fr","/espace-independant"),
   "https://bpei.fr/espace-independant");
 assert.equal(bpeiAuthRedirect("https://bpei-preview.vercel.app",
  "/reinitialiser-mot-de-passe"),
   "https://bpei-preview.vercel.app/reinitialiser-mot-de-passe");
 assert.equal(bpeiAuthRedirect("http://127.0.0.1:3000","/espace-independant"),
   "http://127.0.0.1:3000/espace-independant");
});
test("remote insecure or modified origins never become auth callback addresses",()=>{
 for(const unsafe of [
  "http://bpei.fr","http://bpei-preview.vercel.app",
  "https://evil.test/bpei.fr","https://user:pass@bpei.fr",
  "https://bpei.fr/?code=attacker","https://bpei.fr/#fragment",
  "javascript:alert(1)"
 ])assert.throws(()=>bpeiAuthRedirect(unsafe,"/espace-independant"));
});
test("recovery context requires explicit recovery type, not unrelated PKCE code",()=>{
 assert.equal(isExplicitBpeiRecoveryLink("?code=unrelated",""),false);
 assert.equal(isExplicitBpeiRecoveryLink("?type=recovery&code=abc",""),true);
 assert.equal(isExplicitBpeiRecoveryLink("","#type=recovery&access_token=x"),true);
 assert.equal(isExplicitBpeiRecoveryLink("?type=signup",""),false);
 assert.equal(isExplicitBpeiRecoveryLink("",""),false);
});
