import type { Role } from "@/features/auth/types";
import type { StaffWorkingHoursApi } from "../api-types";

export interface WorkingHourDraft {
  id?: number;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface WorkingHourPayload {
  staff: number;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface WorkingHourMutations {
  create: WorkingHourPayload[];
  update: Array<{ id: number; payload: WorkingHourPayload }>;
  deleteIds: number[];
}

export const schedulableRoles: Role[] = ["ADMIN", "DOCTOR", "NURSE"];

export function isSchedulableRole(role: Role) {
  return schedulableRoles.includes(role);
}

export function normalizeTime(value: string) {
  if (!value) return "";
  return value.length === 5 ? `${value}:00` : value;
}

export function displayTime(value: string) {
  return value.slice(0, 5);
}

export function emptyWeek(): Record<number, WorkingHourDraft[]> {
  return Object.fromEntries(Array.from({ length: 7 }, (_, weekday) => [weekday, []])) as Record<number, WorkingHourDraft[]>;
}

export function groupWorkingHours(rows: StaffWorkingHoursApi[]) {
  const grouped = emptyWeek();
  for (const row of rows) {
    if (!grouped[row.weekday]) grouped[row.weekday] = [];
    grouped[row.weekday].push({
      id: row.id,
      weekday: row.weekday,
      start_time: displayTime(row.start_time),
      end_time: displayTime(row.end_time),
      is_active: row.is_active,
    });
  }
  for (const items of Object.values(grouped)) {
    items.sort((left, right) => left.start_time.localeCompare(right.start_time));
  }
  return grouped;
}

function draftPayload(staff: number, draft: WorkingHourDraft): WorkingHourPayload {
  return {
    staff,
    weekday: draft.weekday,
    start_time: normalizeTime(draft.start_time),
    end_time: normalizeTime(draft.end_time),
    is_active: draft.is_active,
  };
}

export function buildWorkingHourMutations(staff: number, existing: StaffWorkingHoursApi[], grouped: Record<number, WorkingHourDraft[]>): WorkingHourMutations {
  const existingIds = new Set(existing.map((item) => item.id));
  const seenIds = new Set<number>();
  const create: WorkingHourPayload[] = [];
  const update: Array<{ id: number; payload: WorkingHourPayload }> = [];

  for (const drafts of Object.values(grouped)) {
    for (const draft of drafts) {
      if (!draft.start_time || !draft.end_time) continue;
      const payload = draftPayload(staff, draft);
      if (draft.id && existingIds.has(draft.id)) {
        seenIds.add(draft.id);
        update.push({ id: draft.id, payload });
      } else {
        create.push(payload);
      }
    }
  }

  return {
    create,
    update,
    deleteIds: existing.filter((item) => !seenIds.has(item.id)).map((item) => item.id),
  };
}
