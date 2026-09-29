import type { AuthUser } from "../types";
import type { BackendUser } from "./auth-service";

export function mapUser(user: BackendUser): AuthUser {
  const fullName = `${user.first_name} ${user.last_name}`.trim();
  return {
    id: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    professionalTitle: user.professional_title,
    avatarUrl: user.avatar_url,
    isActive: user.is_active,
    displayName: fullName || user.username,
  };
}
