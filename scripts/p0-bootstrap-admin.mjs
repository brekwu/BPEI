#!/usr/bin/env node
/**
 * BPEI P0 — bootstrap the first admin on the dedicated Supabase project.
 * Never run this in the browser, Vercel client bundle or a public workflow.
 * Does not configure SMTP, publish legal documents or open registrations.
 */
import { createClient } from "@supabase/supabase-js";

const EXPECTED_REF = "qmbsfmcotnsxsvbigynz";
const execute = process.argv.includes("--execute");
const url = process.env.BPEI_SUPABASE_URL ?? "";
const key = process.env.BPEI_SUPABASE_SERVICE_KEY ?? "";
const email = (process.env.BPEI_ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.BPEI_ADMIN_PASSWORD ?? "";
const emailVerified = process.env.BPEI_ADMIN_EMAIL_VERIFIED === "true";

function fail(message) {
  console.error("P0 bootstrap rejected:", message);
  process.exitCode = 1;
}

if (!execute) {
  console.log("Dry run only. No account created. Use --execute with the required private environment variables.");
} else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) ||
           new URL(url).hostname !== `${EXPECTED_REF}.supabase.co`) {
  fail("Wrong Supabase project. Refusing to modify any other database.");
} else if (!key || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail("Provide BPEI_SUPABASE_SERVICE_KEY and a valid BPEI_ADMIN_EMAIL.");
} else if (password.length < 16 || !/[a-z]/.test(password) ||
           !/[A-Z]/.test(password) || !/[0-9]/.test(password) ||
           !/[^a-zA-Z0-9]/.test(password)) {
  fail("Provide BPEI_ADMIN_PASSWORD: at least 16 chars, upper/lowercase, digit and symbol.");
} else if (!emailVerified) {
  fail("Set BPEI_ADMIN_EMAIL_VERIFIED=true only after personally verifying ownership of the chosen email.");
} else {
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { bpei_admin_bootstrap: true },
    });
    if (error) throw new Error("Auth admin createUser failed: " + error.message);
    if (!data?.user?.id) throw new Error("Auth returned no user ID.");

    const id = data.user.id;
    // Grant admin only via the private service role, never from client-editable metadata.
    const { error: grantError } = await client.from("independent_admins").insert({ user_id: id });
    if (grantError) {
      throw new Error(
        "Auth account created, but DB admin grant FAILED for user " + id +
        ". Resolve via a privileged SQL console; do not create a duplicate user. " +
        grantError.message
      );
    }
    const { data: check, error: verifyError } = await client.from("independent_admins")
      .select("user_id").eq("user_id", id).single();
    if (verifyError || check?.user_id !== id) {
      throw new Error("Admin grant could not be verified for user " + id);
    }
    console.log("BPEI first admin created and grant verified:", email, id);
    console.log("SMTP and an independent real email-confirmation test are STILL required for public signups.");
  } catch (error) {
    fail(error instanceof Error ? error.message : "Unexpected Supabase failure");
  }
}
