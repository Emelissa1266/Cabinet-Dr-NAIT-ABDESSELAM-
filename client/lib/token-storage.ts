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

export const tokenStorage = {
  read(): null {
    this.clear();
    return null;
  },
  save() {
    this.clear();
  },
  updateTokens() {
    this.clear();
  },
  clear() {
    safeStorage("session")?.removeItem(key);
    safeStorage("local")?.removeItem(key);
  },
};

export function notifyAuthExpired() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("clinic-auth-expired"));
}
