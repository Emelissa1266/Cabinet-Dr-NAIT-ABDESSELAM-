import type { AuthService } from "../types";
import { apiRequest } from "@/lib/api-client";
import { mapUser } from "./user-mapper";

export const authService: AuthService = {
  async login(credentials) {
    const response = await apiRequest<BackendLoginResponse>("auth/login/", {
      method: "POST",
      body: credentials,
      auth: false,
      retryOnUnauthorized: false,
    });
    return { user: mapUser(response.user), role: response.user.role };
  },
  async me() {
    return mapUser(await apiRequest<BackendUser>("auth/me/"));
  },
  async logout() {
    await apiRequest<void>("auth/logout/", {
      method: "POST",
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
  user: BackendUser;
}
