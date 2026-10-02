import { ApiError } from "@/lib/api-client";
import type { AgendaStaff } from "@/features/agenda/types";
import type { Patient } from "@/features/patients/types";
import type { SurgeryAnesthesiaType, SurgeryApi, SurgeryPriority, SurgeryStatus } from "../api-types";

export const surgeryStatusLabels: Record<SurgeryStatus, string> = {
  DRAFT: "Brouillon",
  PLANNED: "Planifiée",
  PREOP_IN_PROGRESS: "Préopératoire",
  READY: "Prête",
  IN_PROGRESS: "Au bloc",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

export const surgeryPriorityLabels: Record<SurgeryPriority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  HIGH: "Haute",
  URGENT: "Urgente",
};

export const anesthesiaLabels: Record<SurgeryAnesthesiaType, string> = {
  LOCAL: "Locale",
  REGIONAL: "Régionale",
  SEDATION: "Sédation",
  GENERAL: "Générale",
  OTHER: "Autre",
};

export function surgeryErrorMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 0) return "Connexion au serveur impossible.";
    return `${cause.status} — ${cause.message}`;
  }
  return "La requête Surgery a échoué.";
}

export function patientName(patient?: Patient) {
  return patient?.name ?? "Patient inconnu";
}

export function staffName(staff?: AgendaStaff | null) {
  if (!staff) return "Non renseigné";
  return staff.display_name || `${staff.first_name} ${staff.last_name}`.trim() || staff.username;
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function dateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 16);
}

export function toIsoFromLocalInput(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return text ? new Date(text).toISOString() : null;
}

export function surgeryPatient(surgery: SurgeryApi, patients: Patient[]) {
  return patients.find((patient) => patient.apiId === surgery.patient);
}

export function statusTone(status: SurgeryStatus) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "READY" || status === "IN_PROGRESS") return "teal" as const;
  if (status === "CANCELLED") return "neutral" as const;
  return "neutral" as const;
}
