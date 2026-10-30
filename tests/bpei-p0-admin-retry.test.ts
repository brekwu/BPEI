import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const hook=readFileSync(new URL("../src/lib/use-bpei-admin-access.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../src/routes/gestion-independants.tsx",import.meta.url),"utf8");
const browser=readFileSync(new URL("../scripts/browser-p0-admin-retry-smoke.mjs",import.meta.url),"utf8");

test("Admin access denial remains fail-closed and retryable",()=>{
 assert.match(hook,/useBpeiAdminAccess\(retryKey = 0\)/);
 assert.match(hook,/\}, \[retryKey\]\);/);
 assert.match(hook,/setAccess\("denied"\)/);
 assert.match(hook,/\.eq\("user_id", data\.user\.id\)/);
});

test("The denied admin page retries the permission check, rather than a blocked load",()=>{
 assert.match(route,/const \[accessRetryKey, setAccessRetryKey\] = useState\(0\)/);
 assert.match(route,/const access = useBpeiAdminAccess\(accessRetryKey\)/);
 assert.match(route,/if\(access !== "allowed"\)setAccessRetryKey\(key => key \+ 1\)/);
 assert.match(route,/else void load\(\)/);
 assert.match(route,/if \(access !== "allowed"\) return false/);
});

test("The browser retry check requires a fresh permission query before showing applications",()=>{
 assert.match(browser,/if\(adminChecks===1\)return route\.fulfill\(json/);
 assert.match(browser,/getByRole\("button",\{name:"Réessayer"\}\)\.click\(\)/);
 assert.match(browser,/assert\.ok\(adminChecks>=3/);
 assert.doesNotMatch(browser,/service_role|auth\.admin\.createUser|stripe\.charges/);
});
