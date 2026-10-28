import assert from "node:assert/strict";

const origin = process.env.BPEI_SMOKE_URL || "http://127.0.0.1:3000";
let healthy = false;

for (let attempt = 0; attempt < 45; attempt++) {
  try {
    const response = await fetch(origin + "/health");
    const payload = await response.json();
    if (response.status === 200 && payload.status === "ok") {
      healthy = true;
      break;
    }
  } catch {
    // Server might still be booting.
  }
  await new Promise(resolve => setTimeout(resolve, 1000));
}

assert.ok(healthy, "GET /health must return status 200 and status=ok");

const routes = [
  ["/", "BPEI"],
  ["/devenir-partenaire", "partenaire"],
  ["/demander-une-intervention", "intervention"],
  ["/candidature-partenaire", "candidature"],
];

for (const [path, expectedText] of routes) {
  const response = await fetch(origin + path, { redirect: "manual" });
  const html = await response.text();
  assert.equal(response.status, 200, path + " HTTP " + response.status);
  assert.ok(html.toLowerCase().includes(expectedText.toLowerCase()),
    path + " did not contain expected page text");
  console.log("SSR OK:", path);
}

console.log("BPEI production-mode HTTP smoke checks passed.");
