import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

/**
 * P0 browser contract tests: exercise the public UI with a simulated open gate.
 * These mocks do NOT prove real SMTP, SQL grants, Auth configuration or RLS.
 */
const base = process.env.BPEI_SMOKE_ORIGIN || "http://127.0.0.1:3000";
const engine = process.env.BPEI_BROWSER_ENGINE ?? "chromium";
assert.ok(["chromium", "webkit"].includes(engine), "Unsupported browser engine");
const browser = await (engine === "webkit" ? webkit : chromium).launch({ headless: true });
const errors = [];
const checked = [];
let signupBody;
let signupRedirect;
let inquiryBody;
let resetBody;
let resetRedirect;

const gate = {
  id: true,
  legal_documents_published: true,
  independent_registration_enabled: true,
  legal_version: "bpei-e2e-v1"
};

function asJson(body, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function testPage(path) {
  const context = await browser.newContext();
  await context.route("https://placeholder.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.startsWith("/auth/v1/signup")) {
      signupBody = request.postDataJSON();
      signupRedirect = url.searchParams.get("redirect_to");
      return route.fulfill(asJson({
        user: { id: "41414141-4141-4141-8141-414141414141", email: signupBody.email },
        session: null
      }));
    }
    if (path.startsWith("/auth/v1/recover")) {
      resetBody = request.postDataJSON();
      resetRedirect = url.searchParams.get("redirect_to");
      return route.fulfill(asJson({}));
    }
    if (path.startsWith("/auth/v1/")) {
      return route.fulfill(asJson({ code: "unauthenticated", message: "Browser smoke" }, 401));
    }
    if (path.includes("/rest/v1/bpei_launch_controls")) return route.fulfill(asJson(gate));
    if (path.includes("/rest/v1/bpei_intake_flags")) return route.fulfill(asJson({ enabled: true }));
    if (path.includes("/rest/v1/bpei_inquiries") && request.method() === "POST") {
      inquiryBody = request.postDataJSON();
      return route.fulfill({ status: 201, body: "", headers: { "content-type": "application/json" } });
    }
    return route.fulfill(asJson([]));
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 20000 });
  assert.equal(response?.status(), 200, "Non-200 HTML response for " + path);
  checked.push(path);
  return { context, page };
}

try {
  {
    const { context, page } = await testPage("/espace-independant");
    await page.getByRole("heading", { name: "Espace technicien indépendant" }).waitFor();
    await page.getByRole("button", { name: "Créer un compte" }).click();
    const button = page.getByRole("button", { name: "Créer mon compte" });
    await page.getByRole("checkbox", { name: /^J.ai pris connaissance de la/ }).waitFor();
    await page.getByPlaceholder("Adresse e-mail").fill("p0-ui@example.test");
    await page.getByPlaceholder("Mot de passe", { exact: true }).fill("TestPassword-2026!");
    await page.getByPlaceholder("Confirmer le mot de passe").fill("DifferentPassword-2026!");
    assert.equal(await button.isDisabled(), true, "Different passwords must block signup");
    await page.getByLabel("Afficher les mots de passe").check();
    assert.equal(await page.getByPlaceholder("Mot de passe", { exact: true }).getAttribute("type"), "text", "Password visibility toggle must show password");
    await page.getByLabel("Afficher les mots de passe").uncheck();
    assert.equal(await page.getByPlaceholder("Mot de passe", { exact: true }).getAttribute("type"), "password");
    await page.getByPlaceholder("Confirmer le mot de passe").fill("TestPassword-2026!");
    assert.equal(await button.isDisabled(), true, "Signup must require legal consent");
    await page.getByRole("checkbox", { name: /^J.ai pris connaissance de la/ }).check();
    assert.equal(await button.isEnabled(), true, "Legal acknowledgment should enable signup");
    await button.click();
    await page.getByText("Vérifiez votre e-mail pour confirmer le compte.").waitFor();
    assert.equal(signupBody?.email, "p0-ui@example.test");
    assert.equal(signupBody?.data?.bpei_legal_version_acknowledged, gate.legal_version);
    assert.match(signupRedirect ?? "", /\/espace-independant$/);
    await context.close();
  }

  {
    const { context, page } = await testPage("/contact");
    await page.getByRole("heading", { name: "Contacter BPEI" }).waitFor();
    await page.getByLabel("Nom et prénom *").fill("Client de test");
    await page.getByLabel("E-mail *").fill("client@example.test");
    await page.getByLabel("Sujet *").fill("Question pour BPEI");
    await page.getByLabel("Description *").fill("Ceci est une demande de test pour valider le formulaire.");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Envoyer le message" }).click();
    await page.getByText(/Votre demande a été enregistrée/).waitFor();
    assert.equal(inquiryBody?.kind, "contact");
    assert.equal(inquiryBody?.consent_accepted, true);
    assert.equal(inquiryBody?.email, "client@example.test");
    await context.close();
  }

  {
    const { context, page } = await testPage("/reinitialiser-mot-de-passe");
    await page.getByRole("heading", { name: "Réinitialiser mon mot de passe" }).waitFor();
    await page.getByLabel("Adresse e-mail du compte").fill("p0-ui@example.test");
    await page.getByRole("button", { name: "Recevoir un lien de réinitialisation" }).click();
    await page.getByText(/Si un compte existe avec cette adresse/).waitFor();
    assert.equal(resetBody?.email, "p0-ui@example.test");
    assert.match(resetRedirect ?? "", new RegExp("/reinitialiser-mot-de-passe$"));
    await context.close();
  }

  assert.deepEqual(errors, [], "Uncaught JS errors in open-flow UI");
  console.log(JSON.stringify({ ok: true, mode: "mocked-open-gate", visited: checked, errors: errors.length }));
} finally {
  await browser.close();
}
