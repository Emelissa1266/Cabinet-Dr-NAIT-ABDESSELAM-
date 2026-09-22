"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/components/auth-provider";
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
  if (!ready || !user) return <main className="session-loading" role="status">Ouverture de votre espace…</main>;
  const signOut = () => { dialogRef.current?.close(); logout(); router.replace("/login"); };
  return <div className="application-shell"><a className="skip-link" href="#main-content">Aller au contenu</a><aside className="desktop-sidebar"><Sidebar user={user} pathname={pathname} onLogout={signOut} /></aside><Header date={date} onOpenNavigation={() => dialogRef.current?.showModal()} /><MainContent>{children}</MainContent><dialog ref={dialogRef} className="mobile-navigation" aria-label="Navigation clinique" onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}><button className="close-navigation" autoFocus onClick={() => dialogRef.current?.close()}>Fermer le menu</button><Sidebar user={user} pathname={pathname} onLogout={signOut} onNavigate={() => dialogRef.current?.close()} /></dialog></div>;
}
