import Link from "next/link";
import { Icon } from "@/components/shared/icon";
import type { NavigationItem as NavigationItemType } from "@/lib/navigation";
export function NavigationItem({ item, active, onNavigate }: { item: NavigationItemType; active: boolean; onNavigate?: () => void }) {
  const content = <>{item.icon ? <Icon name={item.icon} size={15} /> : <span className="nav-icon-space" />}<span>{item.label}</span></>;
  return item.available
    ? <Link href={item.href} className={`nav-item ${active ? "nav-item--active" : ""}`} aria-current={active ? "page" : undefined} onClick={onNavigate}>{content}</Link>
    : <span className="nav-item nav-item--unavailable" aria-disabled="true" title="Module disponible lors d’une prochaine phase">{content}<span className="sr-only"> — À venir</span></span>;
}
