"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {Icon} from "@/components/shared/icon";
import {DetailDialog} from "@/components/ui/detail-dialog";
import {NotificationBell} from "@/features/notifications/components/notification-bell";
import type {AuthUser} from "@/features/auth/types";
import styles from "./secretary.module.css";
export function SecretaryHeader({date,onOpenNavigation,user}:{date:string;onOpenNavigation:()=>void;user:AuthUser}){const router=useRouter();const [query,setQuery]=useState("");const [profileOpen,setProfileOpen]=useState(false);return <><header className="app-header"><button className="mobile-menu-button" aria-label="Ouvrir la navigation" onClick={onOpenNavigation}>Menu</button><strong className={styles.headerTitle}>• Accueil & Secrétariat Administratif</strong><span className={styles.headerDate}>{date}</span><form className={styles.headerSearch} onSubmit={e=>{e.preventDefault();router.push("/secretary/patients?q="+encodeURIComponent(query.trim()));}}><Icon name="search" size={13}/><input aria-label="Recherche administrative" placeholder="Rechercher un patient…" value={query} onChange={e=>setQuery(e.target.value)}/><button>Rechercher</button></form><NotificationBell label="Notifications administratives" /><button className={styles.headerIdentity} onClick={()=>setProfileOpen(true)}><strong>{user.displayName}</strong><small>{user.professionalTitle || "Secrétariat"}</small></button></header><DetailDialog title="Mon profil" open={profileOpen} onClose={()=>setProfileOpen(false)}><h3>{user.displayName}</h3><p>{user.professionalTitle || "Secrétariat"} · Poste accueil</p></DetailDialog></>;}
