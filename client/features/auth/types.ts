export const roles = ["ADMIN", "DOCTOR", "NURSE", "SECRETARY"] as const;
export type Role = (typeof roles)[number];
export interface AuthUser { id: string; username: string; displayName: string; role: Role }
export interface LoginCredentials { username: string; password: string }
/** Contract for the future POST /api/auth/login/ Django endpoint. */
export interface LoginResponse { access: string; refresh: string; user: AuthUser; role: Role }
export interface AuthService { login(credentials: LoginCredentials): Promise<LoginResponse> }
export interface DemoSession { user: AuthUser; expiresAt: number }
