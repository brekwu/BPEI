import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const base = process.env.BPEI_SMOKE_ORIGIN || "http://127.0.0.1:3000";
const engine = process.env.BPEI_BROWSER_ENGINE ?? "chromium";
assert.ok(["chromium", "webkit"].includes(engine), "Unsupported browser engine");
const browser = await (engine === "webkit" ? webkit : chromium).launch({ headless: true });
const context = await browser.newContext();
const errors = [];
const checked = [];

await context.route("https://placeholder.supabase.co/**", async route => {
  const url = new URL(route.request().url());
  const headers = { "content-type": "application/json" };
  if (url.pathname.includes("/rest/v1/bpei_launch_controls")) {
    return route.fulfill({ status: 200, headers, body: JSON.stringify({
      id: true, legal_documents_published: false, independent_registration_enabled: false, legal_version: null
    }) });
  }
  if (url.pathname.includes("/rest/v1/bpei_intake_flags")) {
    return route.fulfill({ status: 200, headers, body: JSON.stringify({ enabled: false }) });
  }
  if (url.pathname.includes("/auth/v1/")) {
    return route.fulfill({ status: 401, headers, body: JSON.stringify({ code: "unauthenticated", message: "Browser smoke test" }) });
  }
  return route.fulfill({ status: 200, headers, body: "[]" });
});

const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));

async function open(path, heading) {
  const response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 20000 });
  assert.equal(response?.status(), 200, "HTTP error at " + path);
  await page.getByRole("heading", { name: heading, level: 1 }).waitFor({ timeout: 15000 });
  checked.push(path);
}

try {
  await open("/", /BPEI|informatique|indépendant/i);
  await open("/espace-independant", "Espace technicien indépendant");
  await page.getByRole("button", { name: "Créer un compte" }).click();
  await page.getByText(/Les nouvelles inscriptions sont suspendues/).waitFor({ timeout: 10000 });
  assert.equal(await page.getByRole("button", { name: "Créer mon compte" }).isDisabled(), true);

  await open("/gestion-independants", "Gestion des indépendants BPEI");
  await open("/gestion-missions", "Gestion des missions BPEI");
  await page.getByText("Accès administrateur non autorisé.").waitFor({timeout:12000});

  await open("/gestion-incidents", "Suivi des incidents BPEI");
  await page.getByText("Accès administrateur non autorisé.").waitFor({timeout:12000});
  await page.getByText(/Accès administrateur non autorisé/).waitFor({ timeout: 12000 });

  await open("/contact", "Contacter BPEI");
  await page.getByText("Formulaire en préparation").waitFor({ timeout: 12000 });

  await open("/demander-une-intervention", "Demander une intervention informatique");
  await page.getByText("Formulaire en préparation").waitFor({ timeout: 12000 });

  for (const [path, heading] of [
    ["/mentions-legales", "Mentions légales"],
    ["/confidentialite", "Politique de confidentialité"],
    ["/cgu", "Conditions générales d'utilisation"],
  ]) {
    await open(path, heading);
    await page.getByText(/Ce document n'est pas encore publié/).waitFor({ timeout: 12000 });
  }

  assert.deepEqual(errors, [], "JavaScript runtime errors detected");
  console.log(JSON.stringify({ ok: true, visited: checked, pageErrors: errors.length }));
} finally {
  await browser.close();
}
