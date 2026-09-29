"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthUser, LoginCredentials } from "../types";
import { authService } from "../services/auth-service";
import { ApiError } from "@/lib/api-client";
import { tokenStorage } from "@/lib/token-storage";

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  isAuthenticated: boolean;
  error: string;
  login: (credentials: LoginCredentials, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);
  const reloadUser = useCallback(async () => {
    if (!tokenStorage.read()) {
      setUser(null);
      return;
    }
    setUser(await authService.me());
  }, []);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        await reloadUser();
      } catch {
        clearSession();
      } finally {
        if (active) setReady(true);
      }
    }
    restore();
    const expire = () => {
      clearSession();
      setReady(true);
    };
    window.addEventListener("clinic-auth-expired", expire);
    window.addEventListener("storage", restore);
    return () => {
      active = false;
      window.removeEventListener("clinic-auth-expired", expire);
      window.removeEventListener("storage", restore);
    };
  }, [clearSession, reloadUser]);
  const logout = useCallback(async () => {
    try { await authService.logout(); }
    catch { /* Local session cleanup is authoritative for the browser UX. */ }
    finally { clearSession(); }
  }, [clearSession]);
  async function login(credentials: LoginCredentials, remember: boolean) {
    setError("");
    try {
      const response = await authService.login(credentials);
      tokenStorage.save({ access: response.access, refresh: response.refresh }, remember);
      setUser(await authService.me());
    } catch (cause) {
      clearSession();
      if (cause instanceof ApiError && cause.status === 401) throw new Error("Nom d’utilisateur ou mot de passe incorrect.");
      const message = cause instanceof Error ? cause.message : "Connexion impossible. Veuillez réessayer.";
      setError(message);
      throw new Error(message);
    }
  }
  return <AuthContext.Provider value={{ user, ready, isAuthenticated: Boolean(user), error, login, logout, reloadUser }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requires AuthProvider");
  return context;
}
