// Entrées publiques exclusivement via le serveur. Ne jamais envoyer la clé de service au navigateur.
import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import {
  InterventionRequestSchema, TechnicianApplicationSchema, TECHNICIAN_CONSENT_VERSION,
  type InterventionRequestInput, type TechnicianApplicationInput,
} from "@/lib/network-forms";
import { enforceRateLimit } from "@/lib/security/rate-limit.server";

async function serverWriter() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Configuration du serveur indisponible.");
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (secret.startsWith("sb_") && headers.get("Authorization") === "Bearer " + secret) headers.delete("Authorization");
        headers.set("apikey", secret);
        return fetch(input, { ...init, headers });
      },
    },
  });
}
function newReference(prefix: string) {
  return prefix + "-" + randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
}

export const submitTechnicianApplication = createServerFn({ method: "POST" })
  .inputValidator((input: TechnicianApplicationInput) => TechnicianApplicationSchema.parse(input))
  .handler(async ({ data }) => {
    if (process.env.BPEI_FORMS_ENABLED !== "true") {
      throw new Error("Les formulaires BPEI ne sont pas encore ouverts.");
    }
    await enforceRateLimit({ endpoint: "network_form" });
    const validated = TechnicianApplicationSchema.parse(data);
    const db = await serverWriter();
    const reference = newReference("TECH");
    const { error } = await db.from("technician_applications").insert({
      reference, first_name: validated.first_name, last_name: validated.last_name,
      email: validated.email.toLowerCase(), phone: validated.phone, city: validated.city,
      postal_code: validated.postal_code.toUpperCase(), business_status: validated.business_status,
      siret: validated.business_status === "immatricule" ? validated.siret : null,
      legal_form: validated.business_status === "immatricule" ? validated.legal_form : null,
      skills: validated.skills, skills_other: validated.skills_other,
      experience_level: validated.experience_level ?? null,
      intervention_modes: validated.intervention_modes,
      service_radius_km: validated.service_radius_km ?? null,
      covered_area: validated.covered_area, availability: validated.availability,
      has_insurance: validated.has_insurance ?? null, message: validated.message,
      acquisition_source: validated.acquisition_source ?? null,
      acquisition_detail: validated.acquisition_detail,
      referral_code: validated.referral_code, utm_source: validated.utm_source,
      utm_medium: validated.utm_medium, utm_campaign: validated.utm_campaign,
      consent: true, consent_version: TECHNICIAN_CONSENT_VERSION,
    });
    if (error) {
      console.error("[BPEI] technician storage failed", error.code ?? "unknown");
      throw new Error("Candidature non enregistrée. Réessayez plus tard.");
    }
    return { ok: true as const, reference };
  });

export const submitInterventionRequest = createServerFn({ method: "POST" })
  .inputValidator((input: InterventionRequestInput) => InterventionRequestSchema.parse(input))
  .handler(async ({ data }) => {
    if (process.env.BPEI_FORMS_ENABLED !== "true") {
      throw new Error("Les formulaires BPEI ne sont pas encore ouverts.");
    }
    await enforceRateLimit({ endpoint: "network_form" });
    const validated = InterventionRequestSchema.parse(data);
    const db = await serverWriter();
    const reference = newReference("INTER");
    const { error } = await db.from("intervention_requests").insert({
      reference, requester_type: validated.requester_type,
      company_name: validated.requester_type === "professionnel" ? validated.company_name : null,
      first_name: validated.first_name, last_name: validated.last_name,
      email: validated.email.toLowerCase(), phone: validated.phone, city: validated.city,
      postal_code: validated.postal_code.toUpperCase(), device_type: validated.device_type,
      problem_category: validated.problem_category, description: validated.description,
      preferred_mode: validated.preferred_mode ?? null, urgency: validated.urgency ?? null,
      availability: validated.availability, acquisition_source: validated.acquisition_source ?? null,
      acquisition_detail: validated.acquisition_detail, referral_code: validated.referral_code,
      utm_source: validated.utm_source, utm_medium: validated.utm_medium,
      utm_campaign: validated.utm_campaign, consent: true,
    });
    if (error) {
      console.error("[BPEI] intervention storage failed", error.code ?? "unknown");
      throw new Error("Demande non enregistrée. Réessayez plus tard.");
    }
    return { ok: true as const, reference };
  });
