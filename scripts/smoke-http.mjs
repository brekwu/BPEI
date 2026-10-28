import assert from "node:assert/strict";
const base = process.env.BPEI_SMOKE_URL || "http://127.0.0.1:3000";
for (const path of ["/","/devenir-partenaire","/comment-ca-marche","/espace-independant","/contact","/mentions-legales","/confidentialite","/health","/sitemap.xml"]) {
 const response = await fetch(base + path, { redirect: "manual", signal: AbortSignal.timeout(10000) });
 console.log(path, response.status);
 assert.equal(response.status, 200, path + " must return HTTP 200");
}
console.log("Public SSR smoke tests passed.");
