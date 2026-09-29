import Image from "next/image";
import type { AuthUser } from "@/features/auth/types";
import { roleLabels } from "@/lib/navigation";
export function UserProfile({ user }: { user: AuthUser }) {
  const initials = user.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || user.username[0]?.toUpperCase() || "U";
  return <div className="user-profile">{user.role === "DOCTOR" ? <Image src={user.avatarUrl ?? "/images/doctor-avatar.png"} alt="" width={32} height={32} className="profile-avatar" /> : <span className="profile-initials" aria-hidden="true">{initials}</span>}<div><p>{user.displayName}</p><span>{user.professionalTitle || roleLabels[user.role]}</span></div></div>;
}
