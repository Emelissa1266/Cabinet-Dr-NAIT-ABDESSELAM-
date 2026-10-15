import type { Role } from "@/features/auth/types";
import type { IconName } from "@/components/shared/icon";

export interface NavigationItem { label: string; href: string; icon?: IconName; roles: readonly Role[]; available: boolean }
const all: readonly Role[] = ["ADMIN", "DOCTOR", "NURSE", "SECRETARY"];
const medical: readonly Role[] = ["ADMIN", "DOCTOR"];
const adminNavigation: readonly NavigationItem[] = [
  { label: "Tableau de bord", href: "/admin", icon: "dashboard", roles: ["ADMIN"], available: true },
  { label: "Utilisateurs", href: "/admin/users", icon: "patients", roles: ["ADMIN"], available: true },
  { label: "Soins", href: "/admin/care", icon: "care", roles: ["ADMIN"], available: true },
  { label: "Agenda", href: "/admin/agenda", icon: "agenda", roles: ["ADMIN"], available: true },
  { label: "Interventions", href: "/admin/surgery", icon: "interventions", roles: ["ADMIN"], available: true },
  { label: "Facturation", href: "/admin/billing", icon: "billing", roles: ["ADMIN"], available: true },
  { label: "Documents", href: "/admin/documents", icon: "patient-folder", roles: ["ADMIN"], available: true },
];
export const navigation: readonly NavigationItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: "dashboard", roles: all, available: true },
  { label: "Patients", href: "/patients", icon: "patients", roles: all, available: true },
  { label: "Agenda", href: "/agenda", icon: "agenda", roles: all, available: true },
  { label: "Interventions", href: "/interventions", icon: "interventions", roles: medical, available: true },
  { label: "Soins", href: "/care", icon: "care", roles: ["ADMIN", "DOCTOR", "NURSE"], available: true },
  { label: "Ordonnances", href: "/prescriptions", icon: "prescriptions", roles: medical, available: true },
  { label: "Arrêts de travail", href: "/work-leaves", icon: "prescriptions", roles: ["DOCTOR"], available: true },
  { label: "Photothèque", href: "/phototheque", icon: "phototheque", roles: ["ADMIN", "DOCTOR", "NURSE"], available: true },
  { label: "Facturation", href: "/billing", icon: "billing", roles: ["ADMIN", "DOCTOR", "SECRETARY"], available: true },
];
export function navigationForRole(role: Role) { if (role === "ADMIN") return adminNavigation; if (role === "SECRETARY") return navigation.filter(item => ["/dashboard", "/patients", "/agenda", "/billing"].includes(item.href)).map(item => ({...item, href: `/secretary${item.href}`, available: true})); if (role === "NURSE") return navigation.filter(item => ["/dashboard", "/patients", "/agenda", "/care", "/phototheque", "/billing"].includes(item.href)).map(item => ({ ...item, href: `/nurse${item.href}`, available: true })); return navigation.filter((item) => item.roles.includes(role)).map((item) => ({ ...item, available: item.available && (item.href === "/dashboard" || role === "DOCTOR") })); }
export const roleLabels: Record<Role, string> = { ADMIN: "Administrateur", DOCTOR: "Chirurgien plasticien", NURSE: "Personnel soignant", SECRETARY: "Secrétariat" };
