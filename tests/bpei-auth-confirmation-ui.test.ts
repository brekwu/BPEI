import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const route = readFileSync(new URL("../src/routes/espace-independant.tsx", import.meta.url), "utf8");

test("P0 signup is gated by published legal documents and explicit consent", () => {
  assert.match(route, /registration && \(!canRegisterIndependent\(launch\) \|\| !privacyChecked\)/);
  assert.match(route, /registration && \(password\.length < 12 \|\| password !== passwordConfirm\)/);
  assert.match(route, /privacyChecked/);
});

test("P0 unconfirmed signup can request a new confirmation, without bypassing provider verification", () => {
  assert.match(route, /result\.error\?\.code === "email_not_confirmed"/);
  assert.match(route, /if \(!result\.data\.session\)/);
  assert.match(route, /supabase\.auth\.resend\(\{/);
  assert.match(route, /type: "signup"/);
  assert.match(route, /emailRedirectTo: bpeiAuthRedirect\(/);
  assert.match(route, /disabled=\{resendingConfirmation \|\| loading\}/);
  assert.doesNotMatch(route, /email_confirm\s*:\s*true|auth\.admin\.updateUserById|\.from\("independent_admins"\)\.insert/);
});

test("P0 interface does not declare delivery guaranteed or a session authenticated before confirmation", () => {
  assert.match(route, /Si votre inscription est en attente et que le service e-mail est disponible/);
  const pending=route.indexOf("if (!result.data.session)");
  const loggedIn=route.indexOf("setUserId(result.data.user.id)",pending);
  assert.ok(pending >= 0 && loggedIn > pending);
  assert.match(route, /setPendingConfirmationEmail\(""/);
});

test("Unconfirmed preprovisioned operator can request an email proof without creating any user",()=>{
 assert.match(route,/supabase\.auth\.signInWithOtp\(\{/);
 assert.match(route,/shouldCreateUser:false/);
 assert.match(route,/email:pendingConfirmationEmail/);
 assert.match(route,/emailRedirectTo:bpeiAuthRedirect\(window\.location\.origin,"\/espace-independant", import\.meta\.env\.VITE_BPEI_AUTH_ORIGIN\)/);
 assert.match(route,/Recevoir un lien de vérification du compte existant/);
 assert.match(route,/!registration && <Button type="button"/);
 assert.match(route,/if \(!pendingConfirmationEmail \|\| resendingConfirmation \|\| loading\) return/);
 assert.match(route,/Si ce compte existe et que l'envoi d'e-mails fonctionne/);
 assert.doesNotMatch(route,/signInWithOtp\(\{[\s\S]*?shouldCreateUser:true/);
 const browser=readFileSync(new URL("../scripts/browser-p0-existing-account-verification-smoke.mjs",import.meta.url),"utf8");
 assert.match(browser,/body\.create_user,false/);
 assert.match(browser,/assert\.equal\(signupCalls,0/);
 assert.match(browser,/authenticated:false/);
});

test("Operator provisioning makes no unsubstantiated email-delivery claim",()=>{
 const src=readFileSync(new URL("../scripts/p0-provision-unconfirmed-admin.mjs",import.meta.url),"utf8");
 assert.match(src,/email_confirm:false/);
 assert.match(src,/email_confirmed_at/);
 assert.match(src,/UNCONFIRMED Auth identity/);
 assert.doesNotMatch(src,/email_confirm:true|auth\.admin\.inviteUserByEmail/);
});

test("Auth signup, resend, existing verification and recovery use configured stable origin",()=>{
 const reset=readFileSync(new URL("../src/routes/reinitialiser-mot-de-passe.tsx",import.meta.url),"utf8");
 assert.equal((route.match(/import\.meta\.env\.VITE_BPEI_AUTH_ORIGIN/g)||[]).length,3);
 assert.equal((reset.match(/import\.meta\.env\.VITE_BPEI_AUTH_ORIGIN/g)||[]).length,1);
});
