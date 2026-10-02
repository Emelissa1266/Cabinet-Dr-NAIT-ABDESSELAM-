"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ModuleSummary } from "@/components/ui/module-summary";
import { StatusBadge } from "@/components/ui/status-badge";
import ui from "@/components/ui/clinical.module.css";
import workspace from "@/components/ui/module-workspace.module.css";
import type { DashboardActivity, DashboardApi, DashboardAppointmentPreview, DashboardCareSessionPreview, DashboardSurgeryPreview } from "../api-types";
import { getDashboard } from "../services/dashboard-api-service";
import { dashboardErrorMessage, dateTime, money } from "../services/dashboard-display";

function AppointmentList({ items }: { items: DashboardAppointmentPreview[] }) {
  return (
    <ul className={workspace.list}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>Rendez-vous planifié</strong>
          <small>{dateTime(item.start_at)}</small>
          <StatusBadge tone="neutral">{item.status}</StatusBadge>
          <Link className={workspace.link} href="/agenda">Agenda</Link>
        </li>
      ))}
      {!items.length && <li>Aucun rendez-vous dans l’aperçu backend.</li>}
    </ul>
  );
}

function SurgeryList({ items }: { items: DashboardSurgeryPreview[] }) {
  return (
    <ul className={workspace.list}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{item.procedure_name}</strong>
          <small>{dateTime(item.planned_date)}</small>
          <StatusBadge tone="teal">{item.status}</StatusBadge>
          <Link className={workspace.link} href="/interventions">Interventions</Link>
        </li>
      ))}
      {!items.length && <li>Aucune intervention prochaine dans l’aperçu backend.</li>}
    </ul>
  );
}

function CareSessionList({ items }: { items: DashboardCareSessionPreview[] }) {
  return (
    <ul className={workspace.list}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>Séance de soin</strong>
          <small>{dateTime(item.scheduled_at)}</small>
          <StatusBadge tone="neutral">{item.status}</StatusBadge>
          <Link className={workspace.link} href={`/nurse/care?session=${item.id}`}>Ouvrir le soin</Link>
        </li>
      ))}
      {!items.length && <li>Aucune séance à venir dans l’aperçu backend.</li>}
    </ul>
  );
}

function FinancialPanel({ financial }: { financial: NonNullable<Extract<DashboardApi, { financial: unknown }>["financial"]> }) {
  return (
    <section className={ui.panel}>
      <h2>Finances</h2>
      <ModuleSummary
        items={[
          { label: "Encours", value: money(financial.outstanding_amount) },
          { label: "Retards", value: money(financial.overdue_amount) },
          { label: "Encaissé aujourd’hui", value: money(financial.paid_today) },
          { label: "Factures impayées", value: String(financial.unpaid_invoices_count) },
        ]}
      />
    </section>
  );
}

function ActivityList({ items }: { items: DashboardActivity[] }) {
  return (
    <ul className={workspace.list}>
      {items.map((item, index) => (
        <li key={`${item.created_at}-${index}`}>
          <strong>{item.action}</strong>
          <small>{item.entity_type} · {item.actor || "Système"} · {dateTime(item.created_at)}</small>
        </li>
      ))}
      {!items.length && <li>Aucune activité récente dans l’aperçu backend.</li>}
    </ul>
  );
}

function DashboardContent({ data }: { data: DashboardApi }) {
  if (data.role === "DOCTOR") {
    return (
      <>
        <ModuleSummary items={[
          { label: "Rendez-vous aujourd’hui", value: String(data.today.appointments_count) },
          { label: "Interventions à venir", value: String(data.upcoming.surgeries_count) },
          { label: "Suivis postopératoires", value: String(data.upcoming.postoperative_followups_count) },
          { label: "Préop à revoir", value: String(data.pending.preop_attention_count) },
          { label: "Notifications non lues", value: String(data.statistics.unread_notifications_count) },
        ]} />
        <div className={workspace.twoColumns}>
          <section className={ui.panel}><h2>Agenda du jour</h2><AppointmentList items={data.today.appointments} /></section>
          <section className={ui.panel}><h2>Interventions à venir</h2><SurgeryList items={data.upcoming.surgeries} /></section>
        </div>
      </>
    );
  }
  if (data.role === "NURSE") {
    return (
      <>
        <ModuleSummary items={[
          { label: "Séances assignées", value: String(data.today.assigned_sessions_count) },
          { label: "Séances terminées", value: String(data.today.completed_sessions_count) },
          { label: "À venir", value: String(data.upcoming.care_sessions_count) },
          { label: "En cours", value: String(data.pending.in_progress_sessions_count) },
          { label: "Soins actifs", value: String(data.pending.assigned_care_count) },
          { label: "Notifications non lues", value: String(data.statistics.unread_notifications_count) },
        ]} />
        <section className={ui.panel}><h2>Prochaines séances</h2><CareSessionList items={data.upcoming.care_sessions} /></section>
      </>
    );
  }
  if (data.role === "SECRETARY") {
    return (
      <>
        <ModuleSummary items={[
          { label: "Rendez-vous aujourd’hui", value: String(data.today.appointments_count) },
          { label: "Patients attendus", value: String(data.today.patients_scheduled_count) },
          { label: "Présents accueil", value: String(data.today.checked_in_count) },
          { label: "À venir", value: String(data.upcoming.appointments_count) },
          { label: "Notifications non lues", value: String(data.statistics.unread_notifications_count) },
        ]} />
        <div className={workspace.twoColumns}>
          <section className={ui.panel}><h2>Rendez-vous</h2><AppointmentList items={data.today.appointments} /></section>
          <FinancialPanel financial={data.financial} />
        </div>
      </>
    );
  }
  return (
    <>
      <ModuleSummary items={[
        { label: "Rendez-vous aujourd’hui", value: String(data.today.appointments_count) },
        { label: "Interventions à venir", value: String(data.upcoming.surgeries_count) },
        { label: "Charge soins", value: String(data.pending.care_workload_count) },
        { label: "Utilisateurs actifs", value: String(data.statistics.active_users_count) },
        { label: "Notifications non lues", value: String(data.statistics.notifications_unread_count) },
      ]} />
      <div className={workspace.twoColumns}>
        <FinancialPanel financial={data.financial} />
        <section className={ui.panel}>
          <h2>Activité récente</h2>
          <ActivityList items={data.recent_activity} />
        </section>
      </div>
    </>
  );
}

export function RealDashboard() {
  const [data, setData] = useState<DashboardApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getDashboard());
    } catch (cause) {
      setData(null);
      setError(dashboardErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <main className={ui.page}><p className={ui.panel} role="status">Chargement du tableau de bord…</p></main>;
  if (error || !data) return <main className={ui.page}><section className={ui.panel}><h1>Tableau de bord</h1><p role="alert">{error || "Tableau de bord indisponible."}</p><button className={ui.action} onClick={() => void load()}>Réessayer</button></section></main>;

  return (
    <main className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>Tableau de bord réel</p>
          <h1 className={ui.title}>Vue opérationnelle {data.role.toLowerCase()}</h1>
          <p className={ui.description}>Agrégats servis par le backend selon votre rôle authentifié.</p>
        </div>
        <button className={ui.action} onClick={() => void load()}>Actualiser</button>
      </header>
      <DashboardContent data={data} />
    </main>
  );
}
