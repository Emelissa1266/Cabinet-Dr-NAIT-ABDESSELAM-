"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/components/auth-provider";
import { NurseHeader } from "@/features/nurse/components/nurse-header";
import { SecretaryHeader } from "@/features/secretary/components/secretary-header";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MainContent } from "./main-content";

export function ApplicationShell({ children, date }: { children: ReactNode; date: string }) {
  const { user, ready, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (ready && !user) router.replace("/login"); }, [ready, user, router]);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const close = () => { if (query.matches) dialogRef.current?.close(); };
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);
  const roleHome = user?.role === "NURSE" ? "/nurse" : user?.role === "SECRETARY" ? "/secretary" : "";
  const currentRoleRoot = /^\/(nurse|secretary)(\/|$)/.exec(pathname)?.[1];
  const wrongRoleRoute = Boolean(user && (roleHome ? !pathname.startsWith(`${roleHome}/`) && pathname !== roleHome : currentRoleRoot));
  useEffect(() => { if (ready && user && wrongRoleRoute) router.replace(`${roleHome}/dashboard`); }, [ready, user, wrongRoleRoute, roleHome, router]);
  if (!ready || !user || wrongRoleRoute) return <main className="session-loading" role="status">Ouverture de votre espace…</main>;
  const signOut = async () => { dialogRef.current?.close(); await logout(); router.replace("/login"); };
  return <div className="application-shell"><a className="skip-link" href="#main-content">Aller au contenu</a><aside className="desktop-sidebar"><Sidebar user={user} pathname={pathname} onLogout={signOut} /></aside>{user.role === "NURSE" ? <NurseHeader user={user} date={date} onOpenNavigation={() => dialogRef.current?.showModal()} /> : user.role === "SECRETARY" ? <SecretaryHeader user={user} date={date} onOpenNavigation={() => dialogRef.current?.showModal()} /> : <Header date={date} onOpenNavigation={() => dialogRef.current?.showModal()} />}<MainContent>{children}</MainContent><dialog ref={dialogRef} className="mobile-navigation" aria-label="Navigation du cabinet" onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}><button className="close-navigation" autoFocus onClick={() => dialogRef.current?.close()}>Fermer le menu</button><Sidebar user={user} pathname={pathname} onLogout={signOut} onNavigate={() => dialogRef.current?.close()} /></dialog></div>;
}
