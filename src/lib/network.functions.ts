// Formulaires publics du réseau national BPEI.
// Les candidatures n'ouvrent AUCUN accès : elles sont seulement enregistrées pour examen par l'équipe BPEI.
import { createServerFn } from "@tanstack/react-start";
import {
  InterventionRequestSchema,
  TechnicianApplicationSchema,
  TECHNICIAN_CONSENT_VERSION,
  type InterventionRequestInput,
  type TechnicianApplicationInput,
} from "@/lib/network-forms";
import { enforceRateLimit } from "@/lib/security/rate-limit.server";

async function serverPublicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function shortRef(prefix: string) {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${time}${random}`;
}

export const submitTechnicianApplication = createServerFn({ method: "POST" })
  .inputValidator((i: TechnicianApplicationInput) => TechnicianApplicationSchema.parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "network_form" });
    const supabase = await serverPublicClient();
    const reference = shortRef("TECH");
    const { error } = await supabase.from("technician_applications").insert({
      reference,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      city: data.city,
      postal_code: data.postal_code.toUpperCase(),
      business_status: data.business_status,
      siret: data.business_status === "immatricule" ? data.siret : null,
      legal_form: data.business_status === "immatricule" ? data.legal_form : null,
      skills: data.skills,
      skills_other: data.skills_other,
      experience_level: data.experience_level ?? null,
      intervention_modes: data.intervention_modes,
      service_radius_km: data.service_radius_km ?? null,
      covered_area: data.covered_area,
      availability: data.availability,
      has_insurance: data.has_insurance ?? null,
      message: data.message,
      acquisition_source: data.acquisition_source ?? null,
      acquisition_detail: data.acquisition_detail,
      referral_code: data.referral_code,
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      consent: true,
      consent_version: TECHNICIAN_CONSENT_VERSION,
    });
    if (error) {
      console.error("[technician_applications] insert failed", error.message);
      throw new Error("Votre candidature n'a pas pu être enregistrée. Réessayez dans quelques minutes.");
    }
    return { ok: true as const, reference };
  });

export const submitInterventionRequest = createServerFn({ method: "POST" })
  .inputValidator((i: InterventionRequestInput) => InterventionRequestSchema.parse(i))
  .handler(async ({ data }) => {
    await enforceRateLimit({ endpoint: "network_form" });
    const supabase = await serverPublicClient();
    const reference = shortRef("INTER");
    const { error } = await supabase.from("intervention_requests").insert({
      reference,
      requester_type: data.requester_type,
      company_name: data.requester_type === "professionnel" ? data.company_name : null,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      city: data.city,
      postal_code: data.postal_code.toUpperCase(),
      device_type: data.device_type,
      problem_category: data.problem_category,
      description: data.description,
      preferred_mode: data.preferred_mode ?? null,
      urgency: data.urgency ?? null,
      availability: data.availability,
      acquisition_source: data.acquisition_source ?? null,
      acquisition_detail: data.acquisition_detail,
      referral_code: data.referral_code,
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      consent: true,
    });
    if (error) {
      console.error("[intervention_requests] insert failed", error.message);
      throw new Error("Votre demande n'a pas pu être enregistrée. Réessayez dans quelques minutes.");
    }
    return { ok: true as const, reference };
  });