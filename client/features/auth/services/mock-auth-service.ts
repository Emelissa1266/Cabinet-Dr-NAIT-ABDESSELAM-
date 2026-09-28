import type { AuthService, AuthUser } from "../types";

// Fictional, public development fixtures. These are not real credentials.
const users: AuthUser[] = [
  { id: "demo-doctor", username: "dr.gaya", displayName: "Dr. Gaya", role: "DOCTOR" },
  { id: "demo-nurse", username: "infirmier.demo", displayName: "Personnel soignant", role: "NURSE" },
  { id: "demo-secretary", username: "secretaire.demo", displayName: "Secrétariat", role: "SECRETARY" },
  { id: "demo-admin", username: "admin.demo", displayName: "Administration", role: "ADMIN" },
];
export const mockAuthService: AuthService = {
  async login({ username, password }) {
    if (process.env.NODE_ENV !== "development") throw new Error("La connexion sera disponible après le raccordement au service d’authentification.");
    await new Promise((resolve) => setTimeout(resolve, 650));
    const user = users.find((candidate) => candidate.username === username.trim());
    if (!user || password !== "DemoClinic!2026") throw new Error("Nom d’utilisateur ou mot de passe incorrect.");
    return { access: "demo-access-not-a-jwt", refresh: "demo-refresh-not-a-jwt", user: { ...user }, role: user.role };
  },
};
