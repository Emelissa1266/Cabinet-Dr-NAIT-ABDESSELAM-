import { ApiError } from "@/lib/api-client";
import type {
  ClinicalPhotoSetApi,
  ClinicalPhotoType,
  ClinicalPhotoViewAngle,
  CreateClinicalPhotoPayload,
  CreateClinicalPhotoSetPayload,
} from "../api-types";
import { dateTime } from "./document-display";

export class PhotoWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoWorkflowError";
  }
}

type PhotoSetValues = {
  title: FormDataEntryValue | null;
  anatomical_area: FormDataEntryValue | null;
  captured_at: FormDataEntryValue | null;
  notes: FormDataEntryValue | null;
};

type PhotoValues = {
  photo_type: FormDataEntryValue | null;
  anatomical_area: FormDataEntryValue | null;
  view_angle: FormDataEntryValue | null;
  photo_set: FormDataEntryValue | null;
  captured_at: FormDataEntryValue | null;
  description: FormDataEntryValue | null;
  notes: FormDataEntryValue | null;
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function capturedAtFromInput(value: FormDataEntryValue | null) {
  const raw = text(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new PhotoWorkflowError("La date de prise est invalide.");
  return date.toISOString();
}

export function buildPhotoSetPayload(patientId: number | string, values: PhotoSetValues): CreateClinicalPhotoSetPayload {
  return {
    patient: patientId,
    title: text(values.title),
    anatomical_area: text(values.anatomical_area),
    captured_at: capturedAtFromInput(values.captured_at),
    notes: text(values.notes),
  };
}

export function buildPhotoUploadPayload(
  patientId: number | string,
  values: PhotoValues,
  image: File,
): CreateClinicalPhotoPayload {
  return {
    patient: patientId,
    image,
    photo_type: (text(values.photo_type) || "BEFORE") as ClinicalPhotoType,
    anatomical_area: text(values.anatomical_area),
    view_angle: (text(values.view_angle) || "OTHER") as ClinicalPhotoViewAngle,
    photo_set: text(values.photo_set) || undefined,
    captured_at: capturedAtFromInput(values.captured_at),
    description: text(values.description),
    notes: text(values.notes),
  };
}

function apiValidationMessage(data: unknown) {
  if (typeof data === "object" && data !== null) {
    if ("captured_at" in data) return "La date de prise est invalide.";
    if ("patient" in data) return "Le patient est requis pour cette opération.";
    if ("title" in data) return "Le titre de la série est requis.";
    if ("anatomical_area" in data) return "La zone anatomique est requise.";
    if ("image" in data) return "L’image clinique est requise ou invalide.";
    if ("detail" in data && typeof data.detail === "string") return data.detail;
    if ("non_field_errors" in data && Array.isArray(data.non_field_errors)) return data.non_field_errors.join(" ");
  }
  return "";
}

export function clinicalPhotoErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof PhotoWorkflowError) return cause.message;
  if (cause instanceof ApiError) {
    if (cause.status === 0) return "Connexion au serveur impossible.";
    if (cause.status === 403) return "Accès refusé pour cette photothèque clinique.";
    if (cause.status === 404) return "Photothèque clinique introuvable ou non accessible.";
    return apiValidationMessage(cause.data) || fallback;
  }
  return fallback;
}

export function upsertPhotoSet(sets: ClinicalPhotoSetApi[], created: ClinicalPhotoSetApi) {
  const exists = sets.some((set) => set.id === created.id);
  return exists ? sets.map((set) => (set.id === created.id ? created : set)) : [created, ...sets];
}

export function patientPhotoSets(sets: ClinicalPhotoSetApi[], patientId: number | string) {
  const expectedPatient = String(patientId);
  return sets.filter((set) => String(set.patient) === expectedPatient);
}

export function photoSetSelectState(
  sets: ClinicalPhotoSetApi[],
  loading: boolean,
  error: string,
): "loading" | "failed" | "empty" | "ready" {
  if (loading) return "loading";
  if (error) return "failed";
  return sets.length > 0 ? "ready" : "empty";
}

export function photoSetsForUploadSelector(sets: ClinicalPhotoSetApi[], photoTypeFilter: ClinicalPhotoType | "") {
  void photoTypeFilter;
  return sets;
}

export function photoSetOptionLabel(set: ClinicalPhotoSetApi) {
  const metadata = [set.anatomical_area, set.captured_at ? dateTime(set.captured_at) : ""].filter(Boolean).join(" · ");
  return metadata ? `${set.title} — ${metadata}` : set.title;
}
