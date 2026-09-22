import Image from "next/image";
export type IconName = "brand" | "username" | "lock" | "eye" | "arrow-right" | "dashboard" | "patients" | "agenda" | "interventions" | "care" | "prescriptions" | "phototheque" | "billing" | "settings" | "search" | "calendar" | "notifications";
export function Icon({ name, size = 16 }: { name: IconName; size?: 13 | 15 | 16 | 20 }) {
  return <Image src={`/icons/${name}.svg`} width={size} height={size} alt="" aria-hidden="true" className={`icon icon--${size}`} />;
}
