import { ApiError } from "@/lib/api-client";
import type { ClinicalPhotoType, ClinicalPhotoViewAngle, DocumentSystemType } from "../api-types";

export const documentSystemLabels: Record<DocumentSystemType, string> = {
  CLINICAL: "Clinique",
  ADMINISTRATIVE: "Administratif",
  CONSENT: "Consentement",
  OTHER: "Autre",
};

export const photoTypeLabels: Record<ClinicalPhotoType, string> = {
  BEFORE: "Avant",
  AFTER: "Après",
  PROGRESS: "Évolution",
  OTHER: "Autre",
};

export const viewAngleLabels: Record<ClinicalPhotoViewAngle, string> = {
  FRONT: "Face",
  LEFT: "Gauche",
  RIGHT: "Droite",
  OBLIQUE_LEFT: "Oblique gauche",
  OBLIQUE_RIGHT: "Oblique droite",
  OTHER: "Autre",
};

export function documentErrorMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 0) return "Connexion au backend impossible.";
    if (cause.status === 403) return "Accès refusé pour ce fichier clinique.";
    if (cause.status === 404) return "Fichier introuvable ou non accessible.";
    return `${cause.status} — ${cause.message}`;
  }
  return "La requête document a échoué.";
}

export function dateOnly(value: string | null | undefined) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00Z`),
  );
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function localDateTimeInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function toIsoFromLocalInput(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  return text ? new Date(text).toISOString() : undefined;
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} Ko`;
  return `${Math.round(size / 1024 / 102.4) / 10} Mo`;
}

export function checksumPreview(value: string) {
  return value ? `${value.slice(0, 10)}…` : "Non renseigné";
}
