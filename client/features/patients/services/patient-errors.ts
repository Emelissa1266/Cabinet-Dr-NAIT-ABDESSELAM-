import { ApiError } from "@/lib/api-client";

export type FieldErrors = Record<string, string>;

export function fieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || typeof error.data !== "object" || error.data === null) return {};
  const result: FieldErrors = {};
  for (const [field, value] of Object.entries(error.data)) {
    if (Array.isArray(value)) result[field] = value.join(" ");
    else if (typeof value === "string") result[field] = value;
  }
  return result;
}

export function patientErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) return "Connexion au serveur impossible.";
    if (error.status === 400) return "Vérifiez les champs du formulaire.";
    if (error.status === 401) return "Votre session a expiré. Reconnectez-vous.";
    if (error.status === 403) return "Vous n’avez pas l’autorisation d’effectuer cette action.";
    if (error.status === 404) return "Patient introuvable.";
    return error.message || "Une erreur serveur est survenue.";
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}
