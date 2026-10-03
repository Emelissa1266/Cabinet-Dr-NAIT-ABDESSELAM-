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
import { appointmentDisplay, careSessionDisplay, dashboardFailureState, dashboardRoleCopy, surgeryDisplay } from "../services/dashboard-view";
import { auditActionLabel, entityLabel, personName, statusLabel } from "@/lib/presentation";

function AppointmentList({ items }: { items: DashboardAppointmentPreview[] }) {
  return (
    <ul className={workspace.list}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{appointmentDisplay(item).title}</strong>
          <span>{appointmentDisplay(item).subtitle}</span>
          <small>{dateTime(item.start_at)}</small>
          <small>{appointmentDisplay(item).meta}</small>
          <StatusBadge tone="neutral">{statusLabel(item.status)}</StatusBadge>
          <Link className={workspace.link} href="/agenda">Agenda</Link>
        </li>
      ))}
      {!items.length && <li>Aucun rendez-vous dans l’aperçu.</li>}
    </ul>
  );
}

function SurgeryList({ items }: { items: DashboardSurgeryPreview[] }) {
  return (
    <ul className={workspace.list}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{surgeryDisplay(item).title}</strong>
          <span>{surgeryDisplay(item).subtitle}</span>
          <small>{dateTime(item.planned_date)}</small>
          <StatusBadge tone="teal">{statusLabel(item.status)}</StatusBadge>
          <Link className={workspace.link} href="/interventions">Interventions</Link>
        </li>
      ))}
      {!items.length && <li>Aucune intervention prochaine dans l’aperçu.</li>}
    </ul>
  );
}

function CareSessionList({ items }: { items: DashboardCareSessionPreview[] }) {
  return (
    <ul className={workspace.list}>
      {items.map((item) => (
        <li key={item.id}>
          <strong>{careSessionDisplay(item).title}</strong>
          <span>{careSessionDisplay(item).subtitle}</span>
          <small>{dateTime(item.scheduled_at)}</small>
          <small>{careSessionDisplay(item).meta}</small>
          <StatusBadge tone="neutral">{statusLabel(item.status)}</StatusBadge>
          <Link className={workspace.link} href={`/nurse/care?session=${item.id}`}>Ouvrir le soin</Link>
        </li>
      ))}
      {!items.length && <li>Aucune séance à venir dans l’aperçu.</li>}
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
          <strong>{auditActionLabel(item.action)}</strong>
          <small>{entityLabel(item.entity_type)} · {personName(item.actor)} · {dateTime(item.created_at)}</small>
        </li>
      ))}
      {!items.length && <li>Aucune activité récente dans l’aperçu.</li>}
    </ul>
  );
}

function DashboardContent({ data }: { data: DashboardApi }) {
  if (data.role === "DOCTOR") {
    return (
      <>
        <ModuleSummary items={[
          { label: "Rendez-vous aujourd’hui", value: String(data.today.appointments_count) },
          { label: "Rendez-vous à venir", value: String(data.upcoming.appointments_count) },
          { label: "Rendez-vous en cours", value: String(data.pending.appointments_in_progress_count) },
          { label: "Interventions à venir", value: String(data.upcoming.surgeries_count) },
          { label: "Suivis postopératoires à venir", value: String(data.upcoming.postoperative_followups_count) },
          { label: "Préop à revoir", value: String(data.pending.preop_attention_count) },
          { label: "Soins prescrits actifs", value: String(data.pending.active_care_count) },
          { label: "Notifications non lues", value: String(data.statistics.unread_notifications_count) },
        ]} />
        <div className={workspace.twoColumns}>
          <section className={ui.panel}><h2>Agenda du jour</h2><AppointmentList items={data.today.appointments} /></section>
          <section className={ui.panel}><h2>Prochains rendez-vous</h2><AppointmentList items={data.upcoming.appointments} /></section>
          <section className={ui.panel}><h2>Interventions à venir</h2><SurgeryList items={data.upcoming.surgeries} /></section>
        </div>
      </>
    );
  }
  if (data.role === "NURSE") {
    return (
      <>
        <ModuleSummary items={[
          { label: "Rendez-vous aujourd’hui", value: String(data.today.appointments_count) },
          { label: "Rendez-vous à venir", value: String(data.upcoming.appointments_count) },
          { label: "Rendez-vous en cours", value: String(data.pending.appointments_in_progress_count) },
          { label: "Séances planifiées aujourd’hui", value: String(data.today.planned_sessions_count) },
          { label: "Séances terminées aujourd’hui", value: String(data.today.completed_sessions_count) },
          { label: "Séances à venir", value: String(data.upcoming.care_sessions_count) },
          { label: "Séances en cours", value: String(data.pending.in_progress_sessions_count) },
          { label: "Soins actifs", value: String(data.pending.assigned_care_count) },
          { label: "Notifications non lues", value: String(data.statistics.unread_notifications_count) },
        ]} />
        <div className={workspace.twoColumns}>
          <section className={ui.panel}><h2>Prochains rendez-vous</h2><AppointmentList items={data.upcoming.appointments} /></section>
          <section className={ui.panel}><h2>Prochaines séances</h2><CareSessionList items={data.upcoming.care_sessions} /></section>
        </div>
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
          { label: "Rendez-vous à venir", value: String(data.upcoming.appointments_count) },
          { label: "Notifications non lues", value: String(data.statistics.unread_notifications_count) },
        ]} />
        <div className={workspace.twoColumns}>
          <section className={ui.panel}><h2>Rendez-vous du jour</h2><AppointmentList items={data.today.appointments} /></section>
          <section className={ui.panel}><h2>Prochains rendez-vous</h2><AppointmentList items={data.upcoming.appointments} /></section>
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
      const failed = dashboardFailureState(dashboardErrorMessage(cause));
      setData(failed.data);
      setError(failed.error);
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
  const copy = dashboardRoleCopy[data.role];

  return (
    <main className={ui.page}>
      <header className={ui.heading}>
        <div>
          <p className={ui.eyebrow}>{copy.eyebrow}</p>
          <h1 className={ui.title}>{copy.title}</h1>
          <p className={ui.description}>{copy.description}</p>
        </div>
        <button className={ui.action} disabled={loading} onClick={() => void load()}>{loading ? "Actualisation…" : "Actualiser"}</button>
      </header>
      <DashboardContent data={data} />
    </main>
  );
}
