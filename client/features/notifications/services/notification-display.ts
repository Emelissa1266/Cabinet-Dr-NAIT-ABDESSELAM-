import { ApiError } from "@/lib/api-client";
import type { NotificationPriority, NotificationType } from "../api-types";

export const notificationTypeLabels: Record<NotificationType, string> = {
  APPOINTMENT: "Rendez-vous",
  SURGERY: "Intervention",
  PREOPERATIVE: "Préopératoire",
  CARE: "Soin",
  BILLING: "Facturation",
  SYSTEM: "Système",
};

export const notificationPriorityLabels: Record<NotificationPriority, string> = {
  LOW: "Faible",
  NORMAL: "Normal",
  HIGH: "Élevé",
  URGENT: "Urgent",
};

export function notificationErrorMessage(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 0) return "Connexion au serveur impossible.";
    if (cause.status === 404) return "Notification introuvable ou non accessible.";
    return cause.message || "Impossible de traiter la notification.";
  }
  return "Impossible de traiter la notification.";
}

export function dateTime(value: string | null | undefined) {
  if (!value) return "Non renseigné";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function priorityTone(priority: NotificationPriority) {
  if (priority === "URGENT" || priority === "HIGH") return "warning" as const;
  if (priority === "NORMAL") return "teal" as const;
  return "neutral" as const;
}
