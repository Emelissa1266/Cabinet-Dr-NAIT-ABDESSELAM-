"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/components/auth-provider";
import ui from "@/components/ui/clinical.module.css";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user && user.role !== "ADMIN") router.replace("/dashboard");
  }, [ready, user, router]);

  if (!ready || !user) return <main className="session-loading" role="status">Ouverture de votre espace...</main>;
  if (user.role !== "ADMIN") {
    return (
      <main className={ui.page}>
        <section className={ui.panel} role="alert">
          <h1>Acces reserve</h1>
          <p>Cette zone de configuration est reservee aux administrateurs du cabinet.</p>
        </section>
      </main>
    );
  }
  return children;
}
