import type { Database } from "@/integrations/supabase/types";

export type ShopRole = Database["public"]["Enums"]["shop_role"];
export type RepairStatus = Database["public"]["Enums"]["repair_status"];
export type RepairPriority = Database["public"]["Enums"]["repair_priority"];
export type DeviceType = Database["public"]["Enums"]["device_type"];
export type CustomerType = Database["public"]["Enums"]["customer_type"];
export type ShopStatus = Database["public"]["Enums"]["shop_status"];

export const SHOP_ROLE_LABEL: Record<ShopRole, string> = {
  employee: "Employé",
  technician: "Technicien",
  shop_manager: "Responsable",
  network_owner: "Propriétaire réseau",
};

export const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  request_received: "Demande reçue",
  device_dropped_off: "Appareil déposé",
  awaiting_diagnosis: "En attente de diagnostic",
  diagnosis_in_progress: "Diagnostic en cours",
  quote_to_prepare: "Devis à préparer",
  quote_sent: "Devis envoyé",
  awaiting_response: "En attente de réponse",
  quote_accepted: "Devis accepté",
  quote_rejected: "Devis refusé",
  awaiting_part: "En attente de pièce",
  part_ordered: "Pièce commandée",
  repair_in_progress: "Réparation en cours",
  testing_in_progress: "Tests en cours",
  repair_completed: "Réparation terminée",
  ready_for_pickup: "Appareil prêt",
  customer_notified: "Client prévenu",
  device_collected: "Appareil récupéré",
  not_repairable: "Non réparable",
  cancelled: "Annulé",
  warranty_return: "Retour SAV",
};

export const REPAIR_STATUS_ORDER: RepairStatus[] = [
  "request_received",
  "device_dropped_off",
  "awaiting_diagnosis",
  "diagnosis_in_progress",
  "quote_to_prepare",
  "quote_sent",
  "awaiting_response",
  "quote_accepted",
  "quote_rejected",
  "awaiting_part",
  "part_ordered",
  "repair_in_progress",
  "testing_in_progress",
  "repair_completed",
  "ready_for_pickup",
  "customer_notified",
  "device_collected",
  "not_repairable",
  "cancelled",
  "warranty_return",
];

export const OPEN_STATUSES: RepairStatus[] = [
  "request_received", "device_dropped_off", "awaiting_diagnosis", "diagnosis_in_progress",
  "quote_to_prepare", "quote_sent", "awaiting_response", "quote_accepted",
  "awaiting_part", "part_ordered", "repair_in_progress", "testing_in_progress",
];
export const AWAITING_DIAG_STATUSES: RepairStatus[] = ["awaiting_diagnosis", "diagnosis_in_progress"];
export const READY_STATUSES: RepairStatus[] = ["ready_for_pickup", "customer_notified"];
export const IN_PROGRESS_STATUSES: RepairStatus[] = ["repair_in_progress", "testing_in_progress", "awaiting_part", "part_ordered"];
export const DONE_STATUSES: RepairStatus[] = ["device_collected", "not_repairable", "cancelled"];

export const REPAIR_PRIORITY_LABEL: Record<RepairPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

export const DEVICE_TYPE_LABEL: Record<DeviceType, string> = {
  laptop: "Ordinateur portable",
  desktop: "Ordinateur fixe",
  mac: "Mac",
  phone: "Téléphone",
  tablet: "Tablette",
  console: "Console",
  printer: "Imprimante",
  server: "Serveur",
  peripheral: "Périphérique",
  other: "Autre",
};

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  individual: "Particulier",
  business: "Professionnel",
};

export const SHOP_STATUS_LABEL: Record<ShopStatus, string> = {
  draft: "Brouillon",
  pending: "En attente",
  under_review: "En vérification",
  validated: "Validée",
  rejected: "Refusée",
  suspended: "Suspendue",
};

// Permission helpers (client-side hints — RLS is the real enforcement)
export function canManageShop(role: ShopRole | "owner" | "admin_bpei"): boolean {
  return role === "shop_manager" || role === "network_owner" || role === "owner" || role === "admin_bpei";
}
export function canManageTeam(role: ShopRole | "owner" | "admin_bpei"): boolean {
  return canManageShop(role);
}
export function canEditSettings(role: ShopRole | "owner" | "admin_bpei"): boolean {
  return canManageShop(role);
}

export function customerDisplayName(c: {
  customer_type: CustomerType;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  if (c.customer_type === "business" && c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "Client sans nom";
}