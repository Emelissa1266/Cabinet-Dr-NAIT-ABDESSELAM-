import Image from "next/image";
import type { AuthUser } from "@/features/auth/types";
import { roleLabels } from "@/lib/navigation";
export function UserProfile({ user }: { user: AuthUser }) {
  return <div className="user-profile">{user.role === "DOCTOR" ? <Image src="/images/doctor-avatar.png" alt="" width={32} height={32} className="profile-avatar" /> : <span className="profile-initials" aria-hidden="true">{user.displayName[0]}</span>}<div><p>{user.displayName}</p><span>{roleLabels[user.role]}</span></div></div>;
}
