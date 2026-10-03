"use client";

import type { ReactNode } from "react";
import { useAuth } from "./auth-provider";

export function DoctorOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready || !user) return null;
  if (user.role !== "DOCTOR") {
    return <section><h1 className="text-2xl font-semibold">Votre espace professionnel</h1><p className="mt-3 text-muted">Votre espace n’est pas disponible pour ce profil.</p></section>;
  }
  return children;
}
