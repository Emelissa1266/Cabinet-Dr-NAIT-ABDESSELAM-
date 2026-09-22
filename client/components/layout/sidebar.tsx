import { ClinicBrand } from "@/components/shared/clinic-brand";
import { Icon } from "@/components/shared/icon";
import { navigationForRole } from "@/lib/navigation";
import type { AuthUser } from "@/features/auth/types";
import { NavigationItem } from "./navigation-item";
import { UserProfile } from "./user-profile";
export function Sidebar({ user, pathname, onNavigate, onLogout }: { user: AuthUser; pathname: string; onNavigate?: () => void; onLogout: () => void }) {
  return <div className="sidebar"><div className="sidebar-brand"><ClinicBrand compact /></div><nav className="sidebar-nav" aria-label="Navigation clinique"><p className="nav-heading">Navigation clinique</p><ul>{navigationForRole(user.role).map((item) => <li key={item.href}><NavigationItem item={item} active={pathname === item.href} onNavigate={onNavigate} /></li>)}</ul></nav><div className="sidebar-footer"><span className="nav-item nav-item--unavailable" aria-disabled="true" title="Disponible lors d’une prochaine phase"><Icon name="settings" />Paramètres</span><UserProfile user={user} /><button className="logout-button" onClick={onLogout}>Se déconnecter</button></div></div>;
}
