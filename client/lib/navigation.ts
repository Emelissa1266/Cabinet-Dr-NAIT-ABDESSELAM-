import type { Role } from "@/features/auth/types";
import type { IconName } from "@/components/shared/icon";

export interface NavigationItem { label: string; href: string; icon?: IconName; roles: readonly Role[]; available: boolean }
const all: readonly Role[] = ["ADMIN", "DOCTOR", "NURSE", "SECRETARY"];
const medical: readonly Role[] = ["ADMIN", "DOCTOR"];
export const navigation: readonly NavigationItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: "dashboard", roles: all, available: true },
  { label: "Patients", href: "/patients", icon: "patients", roles: all, available: true },
  { label: "Agenda", href: "/agenda", icon: "agenda", roles: all, available: false },
  { label: "Interventions", href: "/interventions", icon: "interventions", roles: medical, available: false },
  { label: "Soins", href: "/care", icon: "care", roles: ["ADMIN", "DOCTOR", "NURSE"], available: false },
  { label: "Ordonnances", href: "/prescriptions", icon: "prescriptions", roles: medical, available: false },
  { label: "Photothèque", href: "/phototheque", icon: "phototheque", roles: ["ADMIN", "DOCTOR", "NURSE"], available: false },
  { label: "Facturation", href: "/billing", icon: "billing", roles: ["ADMIN", "DOCTOR", "SECRETARY"], available: false },
];
export function navigationForRole(role: Role) { return navigation.filter((item) => item.roles.includes(role)).map((item) => ({ ...item, available: item.available && (item.href === "/dashboard" || role === "DOCTOR") })); }
export const roleLabels: Record<Role, string> = { ADMIN: "Administrateur", DOCTOR: "Chirurgien plasticien", NURSE: "Personnel soignant", SECRETARY: "Secrétariat" };
