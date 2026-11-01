import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

/**
 * P1 admin UI privacy regression. All Auth and database calls are mocked.
 * A second-tab sign-out must remove cached administrative data immediately.
 * This does not replace live multi-account Supabase/RLS acceptance.
 */
const engine = process.env.BPEI_BROWSER_ENGINE ?? "chromium";
assert.ok(["chromium", "webkit"].includes(engine), "Unsupported browser engine");
const browser = await (engine === "webkit" ? webkit : chromium).launch({ headless: true });
const base = process.env.BPEI_SMOKE_ORIGIN || "http://127.0.0.1:3000";
const id = "12345678-1234-4234-8234-123456789012";
const user = { id, email: "admin-p1@example.invalid", role: "authenticated",
  aud: "authenticated", email_confirmed_at: "2026-10-28T10:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} };
const context = await browser.newContext();
const errors = [];
const json = (data, status = 200) =>
  ({ status, contentType: "application/json", body: JSON.stringify(data) });

await context.route("https://placeholder.supabase.co/**", async route => {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname;
  const single = (req.headers().accept || "").includes("application/vnd.pgrst.object+json");
  if (path === "/auth/v1/token") return route.fulfill(json({
    user, access_token: "mock-p1-admin.token.signature",
    refresh_token: "mock-p1-admin-refresh", expires_in: 3600, token_type: "bearer"
  }));
  if (path === "/auth/v1/user") return route.fulfill(json(user));
  if (path === "/auth/v1/logout") return route.fulfill({ status: 204, body: "" });
  if (path.startsWith("/auth/v1/")) return route.fulfill(json({ message: "No session" }, 401));
  if (path === "/rest/v1/bpei_launch_controls")
    return route.fulfill(json({ id: true, legal_documents_published: false,
      independent_registration_enabled: false, legal_version: null }));
  if (path === "/rest/v1/independent_admins")
    return route.fulfill(json(single ? { user_id: id } : [{ user_id: id }]));
  if (path === "/rest/v1/rpc/bpei_admin_search_missions")
    return route.fulfill(json({ items: [], total: 0, summary: {
      all_count: 0, new_count: 0, accepted_count: 0, in_progress_count: 0,
      completed_count: 0, cancelled_count: 0, attention_count: 0
    } }));
  if (path === "/rest/v1/rpc/bpei_admin_incident_statistics")
    return route.fulfill(json({ total: 0, open: 0, under_review: 0, resolved: 0,
      unassigned: 0, overdue: 0, critical_active: 0, low: 0, normal: 0,
      high: 0, critical: 0, average_resolution_hours: null }));
  return route.fulfill(json(single ? null : []));
});

try {
  const login = await context.newPage();
  login.on("pageerror", e => errors.push(e.message));
  await login.goto(base + "/espace-independant", { waitUntil: "domcontentloaded" });
  await login.getByPlaceholder("Adresse e-mail").fill(user.email);
  await login.getByPlaceholder("Mot de passe", { exact: true }).fill("Mock-password-2026!");
  await login.getByRole("button", { name: "Se connecter", exact: true }).click();
  await login.getByRole("heading", { name: "Mon profil", exact: true }).waitFor({ timeout: 15000 });

  const missions = await context.newPage();
  missions.on("pageerror", e => errors.push(e.message));
  await missions.goto(base + "/gestion-missions", { waitUntil: "domcontentloaded" });
  await missions.getByText("Missions trouvées").waitFor({ timeout: 15000 });

  const incidents = await context.newPage();
  incidents.on("pageerror", e => errors.push(e.message));
  await incidents.goto(base + "/gestion-incidents", { waitUntil: "domcontentloaded" });
  await incidents.getByRole("heading", { name: "Statistiques des incidents" }).waitFor({ timeout: 15000 });

  const applications = await context.newPage();
  applications.on("pageerror", e => errors.push(e.message));
  await applications.goto(base + "/gestion-independants", { waitUntil: "domcontentloaded" });
  await applications.getByRole("heading", { name: "Candidatures (0)" }).waitFor({ timeout: 15000 });

  // The Supabase browser session is shared across tabs in this context.
  await login.getByRole("button", { name: "Se déconnecter" }).click();
  await login.getByRole("button", { name: "Se connecter", exact: true }).waitFor({ timeout: 15000 });
  for (const page of [missions, incidents]) {
    await page.getByText("Accès administrateur non autorisé.").waitFor({ timeout: 15000 });
  }
  await applications.getByText("Accès administrateur non autorisé pour ce compte.").waitFor({ timeout: 15000 });
  assert.equal(await missions.getByText("Missions trouvées").count(), 0,
    "Mission metrics must be removed when the admin session ends");
  assert.equal(await incidents.getByRole("heading", { name: "Statistiques des incidents" }).count(), 0,
    "Incident metrics must be removed when the admin session ends");
  assert.equal(await applications.getByRole("heading", { name: "Candidatures (0)" }).count(), 0,
    "Candidate information must be removed when the admin session ends");
  assert.deepEqual(errors, [], "Unexpected JavaScript errors");
  console.log(JSON.stringify({ ok: true, mode: "mocked-admin-cross-tab-signout",
    deniedAdminRoutes: 3, stalePrivatePanels: 0 }));
} finally {
  await context.close();
  await browser.close();
}
