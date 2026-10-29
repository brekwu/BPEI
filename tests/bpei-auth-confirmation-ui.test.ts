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
