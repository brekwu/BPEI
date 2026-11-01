import test from "node:test";
import assert from "node:assert/strict";
import {bpeiAuthRedirect,isExplicitBpeiRecoveryLink,isMatchingBpeiImplicitRecoverySession} from "../src/lib/bpei-auth-redirect.ts";

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

test("implicit recovery requires matching fragment and session tokens",()=>{
 const hash="#type=recovery&access_token=token-from-email&refresh_token=ref-from-email";
 assert.equal(isMatchingBpeiImplicitRecoverySession(hash,"unrelated-existing-session"),false);
 assert.equal(isMatchingBpeiImplicitRecoverySession(hash,null),false);
 assert.equal(isMatchingBpeiImplicitRecoverySession(hash,"token-from-email"),true);
 assert.equal(isMatchingBpeiImplicitRecoverySession("#type=recovery&access_token=x","x"),false);
 assert.equal(isMatchingBpeiImplicitRecoverySession("#type=signup&access_token=x&refresh_token=y","x"),false);
 assert.equal(isMatchingBpeiImplicitRecoverySession("#type=recovery","x"),false);
});

test("ephemeral Vercel preview links use the configured fixed first-party callback",()=>{
 const preview="https://bpei-preview-abc123-brekwu.vercel.app";
 const canonical="https://bpei-preview.vercel.app";
 assert.equal(bpeiAuthRedirect(preview,"/espace-independant",canonical),
  "https://bpei-preview.vercel.app/espace-independant");
 assert.equal(bpeiAuthRedirect(preview,"/reinitialiser-mot-de-passe",canonical),
  "https://bpei-preview.vercel.app/reinitialiser-mot-de-passe");
 assert.equal(bpeiAuthRedirect("http://127.0.0.1:3000","/espace-independant",canonical),
  "https://bpei-preview.vercel.app/espace-independant");
 assert.equal(bpeiAuthRedirect(preview,"/espace-independant","https://bpei.fr"),
  "https://bpei.fr/espace-independant");
});

test("untrusted configuration never redirects an Auth email to another domain",()=>{
 for(const unsafe of [
  "https://attacker.example",
  "https://bpei-preview.vercel.app.attacker.example",
  "https://bpei.fr.attacker.example",
  "http://bpei-preview.vercel.app",
  "https://bpei-preview.vercel.app/redirect",
  "https://bpei-preview.vercel.app?next=https://attacker.example",
  "https://user@bpei.fr",
  "javascript:alert(1)"
 ])assert.throws(()=>bpeiAuthRedirect("https://bpei-preview.vercel.app",
  "/espace-independant",unsafe));
});
