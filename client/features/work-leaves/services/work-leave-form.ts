import type { LeaveStatus } from "../types";
export const leaveLabels: Record<LeaveStatus, string> = {DRAFT: "Brouillon", ISSUED: "Émis", CANCELLED: "Annulé"};
export function durationDays(start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return 0;
  const first = Date.parse(`${start}T00:00:00Z`), last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return 0;
  if (new Date(first).toISOString().slice(0,10) !== start || new Date(last).toISOString().slice(0,10) !== end) return 0;
  return Math.round((last - first) / 86400000) + 1;
}
export function followingDay(date: string) {return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);}
export function todayDate() {const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;}
export function leaveActions(status: LeaveStatus) {return {edit: status === "DRAFT", issue: status === "DRAFT", remove: status === "DRAFT", cancel: status === "ISSUED", extend: status === "ISSUED", print: status === "ISSUED"};}

export function leaveError(cause: unknown) {
  if(cause && typeof cause === "object" && "status" in cause && cause.status === 400 && "data" in cause) {
    const data=cause.data;
    const collect=(value: unknown): string[] => typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(collect) : value && typeof value === "object" ? Object.values(value).flatMap(collect) : [];
    const messages=collect(data);
    if(messages.length) return messages.join(" ");
  }
  return cause instanceof Error ? cause.message : "Action impossible.";
}
