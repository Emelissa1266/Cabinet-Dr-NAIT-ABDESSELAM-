import { ApiError } from "@/lib/api-client";

export type FieldErrors = Record<string, string>;

export function agendaFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || typeof error.data !== "object" || error.data === null) return {};
  const result: FieldErrors = {};
  for (const [field, value] of Object.entries(error.data)) {
    if (Array.isArray(value)) result[field] = value.join(" ");
    else if (typeof value === "string") result[field] = value;
  }
  return result;
}

function validationMessages(data: unknown): string[] {
  if (Array.isArray(data)) return data.filter((value): value is string => typeof value === "string");
  if (typeof data !== "object" || data === null) return [];
  const messages: string[] = [];
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) messages.push(...value.filter((item): item is string => typeof item === "string"));
    else if (typeof value === "string") messages.push(value);
  }
  return messages;
}

function translateValidationMessage(message: string) {
  const translations: Record<string, string> = {
    "Appointment type requires nurse primary staff.": "Ce type de rendez-vous doit être affecté à un personnel infirmier.",
    "Appointment type requires doctor primary staff.": "Ce type de rendez-vous doit être affecté à un médecin.",
    "Appointment is outside staff working hours.": "Ce créneau est en dehors des horaires de travail du personnel sélectionné.",
    "Appointment overlaps staff time off.": "Ce créneau chevauche une absence du personnel sélectionné.",
    "Appointment overlaps a clinic closure.": "Ce créneau chevauche une fermeture du cabinet.",
    "Appointment conflicts with an existing appointment.": "Ce créneau n'est pas disponible pour ce personnel.",
    "Appointment start_at must be before end_at.": "L'heure de fin doit être postérieure à l'heure de début.",
    "Inactive appointment types cannot be used for new appointments.": "Ce type de rendez-vous est inactif.",
  };
  return translations[message] ?? message;
}

export function agendaErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) return "Connexion au serveur impossible.";
    if (error.status === 400) {
      const translated = validationMessages(error.data).map(translateValidationMessage);
      return translated[0] ?? "Le backend a refusé ce créneau ou ces informations.";
    }
    if (error.status === 401) return "Votre session a expiré. Reconnectez-vous.";
    if (error.status === 403) return "Vous n’avez pas l’autorisation d’effectuer cette action.";
    if (error.status === 404) return "Rendez-vous introuvable.";
    return error.message || "Une erreur serveur est survenue.";
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}
