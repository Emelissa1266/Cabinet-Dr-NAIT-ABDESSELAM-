import type { AuthService } from "../types";
import { mockAuthService } from "./mock-auth-service";

// Replace this adapter with the Django API service when the backend is ready.
// Production fails closed; no real authentication is implemented here.
export const authService: AuthService = {
  async login(credentials) {
    if (process.env.NODE_ENV !== "development") throw new Error("La connexion sera disponible après le raccordement au service d’authentification.");
    return mockAuthService.login(credentials);
  },
};
