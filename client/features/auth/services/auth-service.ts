import type { AuthService } from "../types";
import { apiRequest } from "@/lib/api-client";
import { tokenStorage } from "@/lib/token-storage";
import { mapUser } from "./user-mapper";

export const authService: AuthService = {
  async login(credentials) {
    const response = await apiRequest<BackendLoginResponse>("auth/login/", {
      method: "POST",
      body: credentials,
      auth: false,
      retryOnUnauthorized: false,
    });
    return { access: response.access, refresh: response.refresh, user: mapUser(response.user), role: response.user.role };
  },
  async me() {
    return mapUser(await apiRequest<BackendUser>("auth/me/"));
  },
  async logout() {
    const refresh = tokenStorage.read()?.refresh;
    if (!refresh) return;
    await apiRequest<void>("auth/logout/", {
      method: "POST",
      body: { refresh },
    });
  },
};

export interface BackendUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: "ADMIN" | "DOCTOR" | "NURSE" | "SECRETARY";
  professional_title: string;
  avatar_url: string | null;
  is_active: boolean;
}

interface BackendLoginResponse {
  access: string;
  refresh: string;
  user: BackendUser;
}
