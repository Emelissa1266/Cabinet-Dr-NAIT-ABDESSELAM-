"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/shared/icon";
import { getDashboard } from "@/features/dashboard/services/dashboard-api-service";
import type { AdminDashboardApi } from "@/features/dashboard/api-types";
import { dashboardErrorMessage, money } from "@/features/dashboard/services/dashboard-display";
import { auditActionLabel, dateTime, entityLabel, personName } from "@/lib/presentation";
import ui from "@/components/ui/clinical.module.css";
import { AdminGuard } from "./admin-guard";

const sections: Array<{ href: string; label: string; description: string; icon: IconName }> = [
  { href: "/admin/users", label: "Utilisateurs", description: "Comptes, rôles, activation et accès.", icon: "patients" },
  { href: "/admin/care", label: "Soins", description: "Catégories, types de soins et paramètres.", icon: "care" },
  { href: "/admin/agenda", label: "Agenda", description: "Types de rendez-vous, horaires et fermetures.", icon: "agenda" },
  { href: "/admin/surgery", label: "Interventions", description: "Configuration des interventions et préopératoire.", icon: "interventions" },
  { href: "/admin/billing", label: "Facturation", description: "Services facturables et tarifs.", icon: "billing" },
  { href: "/admin/documents", label: "Documents", description: "Catégories de documents.", icon: "patient-folder" },
];

export function AdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminDashboardApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await getDashboard();
      if (data.role === "ADMIN") setDashboard(data);
      else setError("Tableau de bord administrateur indisponible.");
    } catch (cause) {
      setDashboard(null);
      setError(dashboardErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    getDashboard()
      .then((data) => {
        if (!active) return;
        if (data.role === "ADMIN") setDashboard(data);
        else setError("Tableau de bord administrateur indisponible.");
      })
      .catch((cause) => {
        if (active) setError(dashboardErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <AdminGuard>
      <main className={ui.page}>
        <header className={ui.heading}>
          <div>
            <p className={ui.eyebrow}>Administration</p>
            <h1 className={ui.title}>Back office du cabinet</h1>
            <p className={ui.description}>Configuration système, utilisateurs et catalogues transverses.</p>
          </div>
          <button className={ui.action} disabled={loading} onClick={() => void load()}>{loading ? "Actualisation…" : "Actualiser"}</button>
        </header>
        {error && <p className={ui.panel} role="alert">{error}</p>}
        {loading && <p className={ui.panel} role="status">Chargement du tableau de bord…</p>}
        {dashboard && (
          <section className={ui.toolbar} aria-label="Indicateurs administrateur">
            <article className={ui.panel}><h2>Utilisateurs actifs</h2><p>{dashboard.statistics.active_users_count}</p></article>
            <article className={ui.panel}><h2>Rendez-vous du jour</h2><p>{dashboard.today.appointments_count}</p></article>
            <article className={ui.panel}><h2>Interventions à venir</h2><p>{dashboard.upcoming.surgeries_count}</p></article>
            <article className={ui.panel}><h2>Encours financier</h2><p>{money(dashboard.financial.outstanding_amount)}</p></article>
          </section>
        )}
        <section className={ui.adminGrid} aria-label="Modules administrateur">
          {sections.map((section) => (
            <Link className={ui.adminCard} key={section.href} href={section.href}>
              <span className={ui.adminCardIcon} aria-hidden="true"><Icon name={section.icon} size={20} /></span>
              <h2>{section.label}</h2>
              <p>{section.description}</p>
            </Link>
          ))}
        </section>
        {dashboard?.recent_activity.length ? (
          <section className={ui.section}>
            <h2>Activité récente</h2>
            <ul className={ui.list}>
              {dashboard.recent_activity.map((item, index) => (
                <li key={`${item.created_at}-${index}`}>
                  <strong>{auditActionLabel(item.action)}</strong>
                  <small>{entityLabel(item.entity_type)} · {personName(item.actor)} · {dateTime(item.created_at)}</small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </AdminGuard>
  );
}
