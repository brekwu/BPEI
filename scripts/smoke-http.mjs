import assert from "node:assert/strict";
const base = process.env.BPEI_SMOKE_URL || "http://127.0.0.1:3000";
for (const path of ["/","/devenir-partenaire","/comment-ca-marche","/espace-independant","/contact","/mentions-legales","/confidentialite","/health","/sitemap.xml"]) {
 const response = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(10000) });
 console.log(path, response.status);
 assert.equal(response.status, 200, path + " must return HTTP 200");
}
// CI intentionally points to placeholder Supabase credentials.
// Liveness must succeed, but the separate dependency probe must fail closed.
const dependencyResponse=await fetch(base+"/health/dependencies",{
 redirect:"manual",signal:AbortSignal.timeout(10000)
});
assert.equal(dependencyResponse.status,503,
 "Unconfigured Supabase dependencies must not be reported as healthy");
assert.deepEqual(await dependencyResponse.json(),
 {status:"unavailable",scope:"dependency_only"});
assert.match(dependencyResponse.headers.get("cache-control")??"",/no-store/);
console.log("Public SSR liveness and fail-closed dependency checks passed.");
