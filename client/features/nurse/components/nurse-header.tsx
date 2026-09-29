"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/shared/icon";
import { DetailDialog } from "@/components/ui/detail-dialog";
import type { AuthUser } from "@/features/auth/types";
import styles from "./nurse.module.css";
export function NurseHeader({ date, onOpenNavigation, user }: {
    date: string;
    onOpenNavigation: () => void;
    user: AuthUser;
}) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [panel, setPanel] = useState<"notifications" | "profile" | null>(null);
    return <><header className="app-header"><button className="mobile-menu-button" onClick={onOpenNavigation} aria-label="Ouvrir la navigation" aria-haspopup="dialog">Menu</button><strong className={styles.headerTitle}>Espace Infirmier</strong><form className={styles.headerSearch} onSubmit={e => { e.preventDefault(); router.push(`/nurse/patients?q=${encodeURIComponent(query.trim())}`); }}><Icon name="search" size={13}/><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Rechercher un patient infirmier" placeholder="Rechercher un patient…"/><button type="submit">Rechercher</button></form><div className={styles.headerEnd}><span className={styles.headerDate}>{date}</span><span className={styles.access}>• Soins & traçabilité</span><button aria-label="Notifications infirmières" onClick={() => setPanel("notifications")}><Icon name="notifications"/></button><button className={styles.headerProfile} onClick={() => setPanel("profile")}><strong>{user.displayName}</strong><small>{user.professionalTitle || "Personnel soignant"}</small></button></div></header><DetailDialog title={panel === "profile" ? "Mon profil" : "Notifications"} open={Boolean(panel)} onClose={() => setPanel(null)}>{panel === "profile" ? <><h3>{user.displayName}</h3><p>{user.professionalTitle || "Personnel soignant"} · En service</p><p>{date}</p></> : <><p>Consultez les précautions des patients avant chaque soin.</p><p>Les signalements créés dans la démonstration restent locaux ; aucun message n’est envoyé au praticien.</p></>}</DetailDialog></>;
}
