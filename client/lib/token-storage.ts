export interface StoredTokens {
  access: string;
  refresh: string;
  storage: "local" | "session";
}

const key = "clinic-auth-tokens";

function safeStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = kind === "local" ? window.localStorage : window.sessionStorage;
    const testKey = `${key}:test`;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
}

function parseTokens(raw: string | null, storage: "local" | "session"): StoredTokens | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    if (!("access" in value) || typeof value.access !== "string") return null;
    if (!("refresh" in value) || typeof value.refresh !== "string") return null;
    return { access: value.access, refresh: value.refresh, storage };
  } catch {
    return null;
  }
}

export const tokenStorage = {
  read(): StoredTokens | null {
    return parseTokens(safeStorage("session")?.getItem(key) ?? null, "session")
      ?? parseTokens(safeStorage("local")?.getItem(key) ?? null, "local");
  },
  save(tokens: Pick<StoredTokens, "access" | "refresh">, remember: boolean) {
    this.clear();
    const storage = safeStorage(remember ? "local" : "session");
    if (!storage) throw new Error("Le stockage du navigateur est indisponible.");
    storage.setItem(key, JSON.stringify({ access: tokens.access, refresh: tokens.refresh }));
  },
  updateTokens(access: string, refresh?: string) {
    const tokens = this.read();
    if (!tokens) return;
    const storage = safeStorage(tokens.storage);
    storage?.setItem(key, JSON.stringify({ access, refresh: refresh ?? tokens.refresh }));
  },
  clear() {
    safeStorage("session")?.removeItem(key);
    safeStorage("local")?.removeItem(key);
  },
};

export function notifyAuthExpired() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("clinic-auth-expired"));
}
