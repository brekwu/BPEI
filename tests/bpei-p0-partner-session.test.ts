import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/routes/espace-independant.tsx", import.meta.url), "utf8");

function fragment(start: string, end: string) {
  const first = src.indexOf(start);
  assert.ok(first >= 0, "Missing source anchor: " + start);
  const last = src.indexOf(end, first + start.length);
  assert.ok(last > first, "Missing closing anchor: " + end);
  return src.slice(first, last);
}

test("Partner account switch immediately hides previous user's private records", () => {
  const handler = fragment('supabase.auth.onAuthStateChange((event,session)=>{', '    (supabase as any).from("bpei_launch_controls")');
  assert.match(handler, /event==="SIGNED_OUT"/);
  assert.match(handler, /event==="SIGNED_IN" && session\?\.user\?\.id && session\.user\.id!==sessionUserId\.current/);
  assert.match(handler, /const authEpoch=\+\+dataEpoch\.current/);
  assert.match(handler, /sessionUserId\.current=expectedUserId/);
  const switched=handler.indexOf('if(event==="SIGNED_IN"');
  const cleared=handler.indexOf('clearPrivateState();', switched);
  const hidden=handler.indexOf('setUserId(null);', switched);
  const authenticated=handler.indexOf('supabase.auth.getUser().then', switched);
  const loaded=handler.indexOf('await load(expectedUserId)', switched);
  assert.ok(switched>=0 && cleared>switched && hidden>cleared && authenticated>hidden && loaded>authenticated,
    "Sensitive data must be hidden before network verification and reload");
});

test("Async identity verification cannot resurrect stale users after another auth event", () => {
  const handler = fragment('supabase.auth.onAuthStateChange((event,session)=>{', '    (supabase as any).from("bpei_launch_controls")');
  assert.match(handler, /window\.setTimeout\(\(\)=>\{/);
  assert.match(handler, /dataEpoch\.current!==authEpoch\|\|sessionUserId\.current!==expectedUserId/g);
  assert.match(handler, /data\.user\?\.id!==expectedUserId/);
  assert.match(handler, /sessionUserId\.current=null/);
  assert.match(handler, /Impossible de confirmer la nouvelle session/);
  const read=fragment('async function load(id: string): Promise<boolean>', '  useEffect(() => {');
  assert.match(read, /const epoch=\+\+dataEpoch\.current/);
  assert.match(read, /if\(epoch!==dataEpoch\.current\)return false/g);
  const signIn=fragment('async function signIn(e: FormEvent<HTMLFormElement>)', '  async function resendConfirmation()');
  assert.match(signIn, /sessionUserId\.current=result\.data\.user\.id/);
});

test("A session switch neither elevates roles nor bypasses legal registration gates", () => {
  assert.match(src, /registration && \(!canRegisterIndependent\(launch\) \|\| !privacyChecked\)/);
  assert.doesNotMatch(src, /auth\.admin\.updateUserById|email_confirm\s*:\s*true/);
});
