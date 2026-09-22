import { Icon } from "./icon";
export function ClinicBrand({ compact = false }: { compact?: boolean }) {
  return <div className={`clinic-brand ${compact ? "clinic-brand--compact" : ""}`}><span className="clinic-emblem"><Icon name="brand" size={20} /></span><div><p className="clinic-name">Cabinet Dr NAIT<br />ABDESSELAM Gaya</p><p className="clinic-specialty">Chirurgie esthétique</p></div></div>;
}
