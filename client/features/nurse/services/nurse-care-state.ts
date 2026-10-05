import type { CareApi, CareSessionApi } from "@/features/care/api-types";

export function mergeById<T extends { id: number }>(items: T[], item: T) {
  return [item, ...items.filter((current) => current.id !== item.id)];
}

export function replaceById<T extends { id: number }>(items: T[], item: T) {
  return items.map((current) => (current.id === item.id ? item : current));
}

export function eligibleSessionCares(cares: CareApi[]) {
  return cares.filter((care) => !["COMPLETED", "CANCELLED"].includes(care.status) && care.remaining_sessions > 0);
}

export function mergeCreatedSession(sessions: CareSessionApi[], session: CareSessionApi) {
  return mergeById(sessions, session);
}
