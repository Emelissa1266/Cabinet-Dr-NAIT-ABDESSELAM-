export const roles = ["ADMIN", "DOCTOR", "NURSE", "SECRETARY"] as const;
export type Role = (typeof roles)[number];
export interface AuthUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
  professionalTitle: string;
  avatarUrl: string | null;
  isActive: boolean;
  displayName: string;
}
export interface LoginCredentials { username: string; password: string }
export interface LoginResponse { user: AuthUser; role: Role }
export interface AuthService {
  login(credentials: LoginCredentials): Promise<LoginResponse>;
  me(): Promise<AuthUser>;
  logout(): Promise<void>;
}
