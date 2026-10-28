export type BpeiInquiryKind = "contact" | "intervention";
export type BpeiInquiryDraft = {
  kind: BpeiInquiryKind;
  client_name: string;
  email: string;
  phone: string;
  city: string;
  subject: string;
  description: string;
  consent_accepted: boolean;
};
export type BpeiInquiryPayload = {
  kind: BpeiInquiryKind;
  client_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  subject: string;
  description: string;
  consent_accepted: true;
};
export function validateBpeiInquiry(input: BpeiInquiryDraft): { ok: true; data: BpeiInquiryPayload } | { ok: false; error: string } {
  if (input.kind !== "contact" && input.kind !== "intervention") return {ok:false,error:"Type de demande inconnu."};
  const name = input.client_name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const city = input.city.trim();
  const subject = input.subject.trim();
  const description = input.description.trim();
  if (name.length < 2 || name.length > 120) return {ok:false,error:"Le nom doit contenir entre 2 et 120 caractères."};
  if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {ok:false,error:"Adresse e-mail invalide."};
  if (phone.length > 40 || city.length > 120) return {ok:false,error:"Téléphone ou ville trop long."};
  if (input.kind === "intervention" && city.length < 2) return {ok:false,error:"La ville d'intervention est obligatoire."};
  if (subject.length < 3 || subject.length > 160) return {ok:false,error:"Le sujet doit contenir entre 3 et 160 caractères."};
  if (description.length < 15 || description.length > 3000) return {ok:false,error:"La description doit contenir entre 15 et 3000 caractères."};
  if (input.consent_accepted !== true) return {ok:false,error:"Vous devez confirmer avoir pris connaissance des informations de traitement des données."};
  return {ok:true,data:{kind:input.kind,client_name:name,email,phone:phone||null,city:city||null,subject,description,consent_accepted:true}};
}
