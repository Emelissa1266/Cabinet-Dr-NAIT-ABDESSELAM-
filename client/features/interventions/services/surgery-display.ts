import { ApiError } from "@/lib/api-client";
import type { AgendaStaff } from "@/features/agenda/types";
import type { Patient } from "@/features/patients/types";
import type {
  IntraoperativeEventType,
  IntraoperativeSeverity,
  PreopChecklistStatus,
  PreopReadinessStatus,
  PreopRequirementStatus,
  PreopRequirementType,
  SurgeryAnesthesiaType,
  SurgeryApi,
  SurgeryComplicationSeverity,
  SurgeryConsentStatus,
  SurgeryPriority,
  SurgeryStatus,
  SurgeryTeamRole,
} from "../api-types";

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

export const preopReadinessLabels: Record<PreopReadinessStatus, string> = {
  PENDING: "En attente",
  NEEDS_REVIEW: "À revoir",
  READY: "Prêt",
  NOT_READY: "Non prêt",
};

export const preopChecklistStatusLabels: Record<PreopChecklistStatus, string> = {
  PENDING: "En attente",
  COMPLETED: "Réalisé",
  NOT_APPLICABLE: "Non applicable",
  BLOCKED: "Bloqué",
};

export const preopRequirementTypeLabels: Record<PreopRequirementType, string> = {
  LAB: "Analyse",
  IMAGING: "Imagerie",
  ANESTHESIA: "Anesthésie",
  MEDICAL_CLEARANCE: "Avis médical",
  OTHER: "Autre",
};

export const preopRequirementStatusLabels: Record<PreopRequirementStatus, string> = {
  PENDING: "En attente",
  SATISFIED: "Satisfait",
  BLOCKED: "Bloqué",
  WAIVED: "Dispensé",
};

export const surgeryConsentStatusLabels: Record<SurgeryConsentStatus, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  DECLINED: "Refusé",
  REVOKED: "Révoqué",
};

export const surgeryTeamRoleLabels: Record<SurgeryTeamRole, string> = {
  SURGEON: "Chirurgien",
  ASSISTANT: "Assistant",
  NURSE: "Infirmier",
  ANESTHESIA: "Anesthésie",
  OTHER: "Autre",
};

export const intraoperativeEventTypeLabels: Record<IntraoperativeEventType, string> = {
  MEDICATION: "Médication",
  COMPLICATION: "Complication",
  OBSERVATION: "Observation",
  DEVICE: "Dispositif",
  OTHER: "Autre",
};

export const intraoperativeSeverityLabels: Record<Exclude<IntraoperativeSeverity, "">, string> = {
  LOW: "Faible",
  MODERATE: "Modérée",
  HIGH: "Élevée",
  CRITICAL: "Critique",
};

export const surgeryComplicationSeverityLabels: Record<SurgeryComplicationSeverity, string> = {
  MINOR: "Mineure",
  MODERATE: "Modérée",
  SEVERE: "Sévère",
  CRITICAL: "Critique",
};

export const fastingStatusLabels: Record<string, string> = {
  UNKNOWN: "Non renseigné",
  CONFIRMED: "Confirmé",
  NOT_FASTED: "Non à jeun",
  NOT_REQUIRED: "Non requis",
};

export const anesthesiaEvaluationStatusLabels: Record<string, string> = {
  PENDING: "En attente",
  CLEARED: "Validée",
  NEEDS_REVIEW: "À revoir",
  NOT_REQUIRED: "Non requise",
};

export const pregnancyStatusLabels: Record<string, string> = {
  NOT_APPLICABLE: "Non applicable",
  UNKNOWN: "Non renseigné",
  NEGATIVE: "Négatif",
  POSITIVE: "Positif",
};

export const preopReviewLabels: Record<string, string> = {
  medical_history_reviewed: "Antécédents vérifiés",
  allergies_reviewed: "Allergies vérifiées",
  medications_reviewed: "Traitements vérifiés",
  contraindications_reviewed: "Contre-indications vérifiées",
  required_tests_reviewed: "Examens requis vérifiés",
};

export function surgeryErrorMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 0) return "Connexion au serveur impossible.";
    return cause.message || "Impossible de traiter l’intervention.";
  }
  return "Impossible de traiter l’intervention.";
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
