"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser, DemoSession, LoginCredentials } from "../types";
import { authService } from "../services/auth-service";
import { clearDemoSession, readDemoSession, saveDemoSession } from "../services/demo-session";

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (credentials: LoginCredentials, remember: boolean) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => { setSession(readDemoSession()); setReady(true); };
    const timer = window.setTimeout(sync, 0);
    window.addEventListener("storage", sync);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", sync); };
  }, []);
  const logout = useCallback(() => {
    try { clearDemoSession(); } finally { setSession(null); }
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(logout, Math.max(0, session.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session, logout]);
  async function login(credentials: LoginCredentials, remember: boolean) {
    const response = await authService.login(credentials);
    const next = { user: response.user, expiresAt: Date.now() + (remember ? 7 * 24 : 8) * 60 * 60 * 1000 };
    // Store only fictional profile data, never passwords or API tokens.
    try { saveDemoSession(next, remember); }
    catch { throw new Error("Le stockage du navigateur est indisponible. Autorisez-le pour ouvrir la session de démonstration."); }
    setSession(next);
  }
  return <AuthContext.Provider value={{ user: session?.user ?? null, ready, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requires AuthProvider");
  return context;
}
