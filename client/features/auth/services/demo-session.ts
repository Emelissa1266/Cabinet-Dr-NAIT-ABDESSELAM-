import { roles, type DemoSession } from "../types";
const key = "clinic-development-session";
export function clearDemoSession() {
  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}
export function saveDemoSession(session: DemoSession, remember: boolean) {
  clearDemoSession();
  (remember ? window.localStorage : window.sessionStorage).setItem(key, JSON.stringify(session));
}
export function readDemoSession(): DemoSession | null {
  if (process.env.NODE_ENV !== "development") return null;
  try {
    const raw = window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("user" in value) || !("expiresAt" in value)) return null;
    const { user, expiresAt } = value;
    if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    if (typeof user !== "object" || user === null) return null;
    if (!("id" in user) || typeof user.id !== "string" || !("username" in user) || typeof user.username !== "string" || !("displayName" in user) || typeof user.displayName !== "string" || !("role" in user) || !roles.some((role) => role === user.role)) return null;
    return value as DemoSession;
  } catch { return null; }
}
