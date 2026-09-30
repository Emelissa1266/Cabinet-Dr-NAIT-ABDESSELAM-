import { ApiError } from "@/lib/api-client";
import type { AgendaStaff } from "@/features/agenda/types";
import type { Patient } from "@/features/patients/types";
import type { CareApi, CareSessionApi, CareSessionStatus, CareStatus, CareTypeApi, ClinicalMeasurementType } from "../api-types";

export const careStatusLabels: Record<CareStatus, string> = {
  PLANNED: "Planifié",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

export const sessionStatusLabels: Record<CareSessionStatus, string> = {
  PLANNED: "Planifié",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
};

export const measurementTypeLabels: Record<ClinicalMeasurementType, string> = {
  TEMPERATURE: "Température",
  BLOOD_PRESSURE: "Tension artérielle",
  HEART_RATE: "Fréquence cardiaque",
  OXYGEN_SATURATION: "Saturation O2",
  WEIGHT: "Poids",
  PAIN_SCORE: "Douleur",
  OTHER: "Autre",
};

export function careErrorMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 0) return "Connexion au backend impossible.";
    return `${cause.status} — ${cause.message}`;
  }
  return "La requête Care a échoué.";
}

export function patientName(patient?: Patient) {
  return patient?.name ?? "Patient inconnu";
}

export function staffName(staff?: AgendaStaff | null) {
  if (!staff) return "Non assigné";
  return staff.display_name || `${staff.first_name} ${staff.last_name}`.trim() || staff.username;
}

export function careTypeName(careType?: CareTypeApi) {
  return careType?.name ?? "Type de soin inconnu";
}

export function dateOnly(value: string | null | undefined) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function decimalAmount(value: string | null | undefined) {
  if (!value) return "0,00 DA";
  const [major, minor = "00"] = value.split(".");
  return `${major.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${minor ? `,${minor.slice(0, 2).padEnd(2, "0")}` : ""} DA`;
}

export function carePatient(care: CareApi, patients: Patient[]) {
  return patients.find((patient) => patient.apiId === care.patient);
}

export function careType(care: CareApi, careTypes: CareTypeApi[]) {
  return careTypes.find((item) => item.id === care.care_type);
}

export function careSessionTime(session: CareSessionApi) {
  return dateTime(session.scheduled_at);
}
