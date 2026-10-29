import { describe, test, expect } from "bun:test";
import {
  TechnicianApplicationSchema, InterventionRequestSchema, readTrackingParams,
} from "../src/lib/network-forms";

const tech = {
  first_name: "Camille", last_name: "Test", email: "camille@example.org", phone: "0612345678",
  city: "Lyon", postal_code: "69003", business_status: "immatricule" as const,
  siret: "12345678901234", skills: ["depannage_pc"], intervention_modes: ["domicile"], consent: true,
};
const client = {
  first_name: "Alex", last_name: "Test", email: "alex@example.org", phone: "0612345678",
  city: "Lyon", postal_code: "69003", requester_type: "particulier" as const,
  description: "Mon ordinateur ne démarre plus depuis hier et reste bloqué.", consent: true,
};

describe("Candidature technicien", () => {
  test("accepte un dossier valide", () => expect(TechnicianApplicationSchema.safeParse(tech).success).toBe(true));
  test("refuse le consentement absent", () => expect(TechnicianApplicationSchema.safeParse({ ...tech, consent: false }).success).toBe(false));
  test("refuse une compétence vide", () => expect(TechnicianApplicationSchema.safeParse({ ...tech, skills: [] }).success).toBe(false));
  test("refuse un SIRET mal formé", () => expect(TechnicianApplicationSchema.safeParse({ ...tech, siret: "123" }).success).toBe(false));
  test("refuse un code postal invalide", () => expect(TechnicianApplicationSchema.safeParse({ ...tech, postal_code: "690" }).success).toBe(false));
  test("nettoie les espaces du SIRET", () => {
    const result = TechnicianApplicationSchema.safeParse({ ...tech, siret: "123 456 789 01234" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.siret).toBe("12345678901234");
  });
  test("accepte le statut en projet sans SIRET", () => expect(TechnicianApplicationSchema.safeParse({ ...tech, business_status: "en_projet", siret: null }).success).toBe(true));
});
describe("Demande d'intervention", () => {
  test("accepte une demande valide", () => expect(InterventionRequestSchema.safeParse(client).success).toBe(true));
  test("refuse le consentement absent", () => expect(InterventionRequestSchema.safeParse({ ...client, consent: false }).success).toBe(false));
  test("refuse une description trop courte", () => expect(InterventionRequestSchema.safeParse({ ...client, description: "Panne" }).success).toBe(false));
  test("refuse une adresse email incorrecte", () => expect(InterventionRequestSchema.safeParse({ ...client, email: "xxx" }).success).toBe(false));
  test("normalise le parrainage", () => {
    const result = InterventionRequestSchema.safeParse({ ...client, referral_code: "test_42" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.referral_code).toBe("TEST_42");
  });
});
describe("Suivi de campagne", () => {
  test("accepte les paramètres utm", () => expect(readTrackingParams("?ref=abc12&utm_source=instagram").referral_code).toBe("ABC12"));
  test("rejette un code parrain contenant des caractères invalides", () => expect(readTrackingParams("?ref=%3Cscript%3E").referral_code).toBe(null));
});
