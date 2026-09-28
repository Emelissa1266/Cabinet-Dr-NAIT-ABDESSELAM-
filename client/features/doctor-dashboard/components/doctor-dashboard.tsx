"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/icon";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { DashboardAppointment, DashboardPriority, DoctorDashboardData, AppointmentStatus } from "../types";
import styles from "./doctor-dashboard.module.css";

const statuses: Record<AppointmentStatus, { label: string; tone: StatusTone }> = {
  "waiting-room": { label: "En salle d’attente", tone: "warning" },
  confirmed: { label: "Confirmé", tone: "success" },
  prepared: { label: "Préparée", tone: "teal" },
  pending: { label: "En attente", tone: "neutral" },
};

function AppointmentRow({ appointment, onSelect }: { appointment: DashboardAppointment; onSelect: () => void }) {
  const status = statuses[appointment.status];
  return (
    <li>
      <button className={`${styles.appointment} ${appointment.status === "prepared" ? styles.prepared : ""}`} onClick={onSelect}>
        <time className={styles.time}>{appointment.startTime}</time>
        <span className={styles.patient}>
          <span className={styles.patientTitle}><strong>{appointment.patientName}</strong><span className={styles.patientId}>#{appointment.patientId}</span>{appointment.room && <span className={styles.room}>{appointment.room}</span>}</span>
          <span className={styles.description}>{appointment.type}<span aria-hidden="true"> · </span>{appointment.description}</span>
        </span>
        <span className={styles.status}><StatusBadge tone={status.tone}>{status.label}</StatusBadge></span>
        <Icon name="chevron-right" size={13} />
      </button>
    </li>
  );
}

function PriorityCard({ priority, onSelect }: { priority: DashboardPriority; onSelect: () => void }) {
  return (
    <article className={`${styles.priority} ${styles[priority.tone]}`}>
      <div className={styles.priorityHeading}><h3><Icon name={priority.icon} size={15} />{priority.title}</h3>{priority.time ? <time className={styles.room}>{priority.time}</time> : <span className={styles.dot} />}</div>
      <p className={styles.prioritySubtitle}>{priority.subtitle}</p>
      <p className={styles.priorityDescription}>{priority.description}</p>
      <div className={styles.priorityFooter}><span>{priority.footer}</span><button onClick={onSelect}>{priority.action}<Icon name={priority.tone === "warning" ? "arrow-warning" : "arrow-teal"} size={13} /></button></div>
    </article>
  );
}

export function DoctorDashboard({ data }: { data: DoctorDashboardData }) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<DashboardAppointment | null>(null);
  const [priority, setPriority] = useState<DashboardPriority | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteValidated, setNoteValidated] = useState(false);
  const appointments = data.appointments.filter((item) => !filter || item.type === filter);
  const dateLabel = new Intl.DateTimeFormat("fr-DZ", { dateStyle: "full", timeZone: "Africa/Algiers" }).format(new Date(`${data.date}T12:00:00+01:00`));

  return (
    <div className={styles.dashboard}>
      <div className={styles.heading}>
        <div><p className="page-eyebrow">{data.room}</p><h1>Bonjour, {data.doctorName}</h1><p className={styles.subtitle}>{dateLabel}<span>—</span>Cabinet Dr NAIT ABDESSELAM Gaya</p></div>
        <div className={styles.headingActions}><span className={styles.availability}><Icon name="availability" size={13} />Bloc opératoire A disponible</span><button className={styles.primaryAction} disabled title="La modification de l’agenda sera disponible dans le module Agenda"><Icon name="edit-agenda" size={13} />Modifier l’agenda</button></div>
      </div>
      <section className={styles.summary} aria-label="Activité du jour">
        <div><span className={styles.dot} /><strong>{data.summary.appointments}</strong> rendez-vous aujourd’hui</div>
        <span className={styles.separator}>/</span>
        <div><span className={`${styles.dot} ${styles.warning}`} /><strong>{data.summary.interventions}</strong> interventions chirurgicales</div>
        <span className={styles.separator}>/</span>
        <div><span className={`${styles.dot} ${styles.neutral}`} /><strong>{data.summary.followUps}</strong> suivis postopératoires</div>
        <div className={styles.next}><Icon name="clock" size={13} />Prochain acte à {data.appointments[0]?.startTime ?? "—"}</div>
      </section>
      <div className={styles.columns}>
        <section aria-labelledby="daily-agenda">
          <div className={styles.sectionHeading}><h2 id="daily-agenda">Agenda du jour <span className={styles.count}>{data.appointments.length} restants</span></h2><label className={styles.filter}><Icon name="filter" size={13} /><span className="sr-only">Filtrer par acte</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Filtrer par acte</option>{[...new Set(data.appointments.map((item) => item.type))].map((type) => <option key={type}>{type}</option>)}</select></label></div>
          <ul className={styles.appointments}>{appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onSelect={() => setSelected(appointment)} />)}</ul>
        </section>
        <section aria-labelledby="priorities">
          <div className={styles.sectionHeading}><h2 id="priorities">À traiter</h2><span className={styles.caption}>Priorités</span></div>
          <div className={styles.priorities}>{data.priorities.map((item) => <PriorityCard key={item.id} priority={item} onSelect={() => setPriority(item)} />)}</div>
          <div className={styles.voiceNote}><span className={styles.voiceIcon}><Icon name="voice-note" size={15} /></span><div><p>Note vocale transcrite</p><span>Post-consultation #CL-4410</span></div><button onClick={() => setNoteOpen(true)}>{noteValidated ? "Validée" : "Valider"}</button></div>
        </section>
      </div>
      <DetailDialog title={selected?.patientName ?? "Rendez-vous"} open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected && <dl><dt>Patient</dt><dd>{selected.patientName} · #{selected.patientId}</dd><dt>Type</dt><dd>{selected.type}</dd><dt>Date</dt><dd>{dateLabel}</dd><dt>Horaire</dt><dd>{selected.startTime} – {selected.endTime}</dd><dt>Médecin</dt><dd>{data.doctorName}</dd><dt>Motif</dt><dd>{selected.description}</dd><dt>Statut</dt><dd><StatusBadge tone={statuses[selected.status].tone}>{statuses[selected.status].label}</StatusBadge></dd>{selected.room && <><dt>Salle</dt><dd>{selected.room}</dd></>}</dl>}
      </DetailDialog>
      <DetailDialog title={priority?.title ?? "Priorité"} open={Boolean(priority)} onClose={() => setPriority(null)}>
        {priority && <><h3>{priority.subtitle}</h3><p>{priority.description}</p><p>{priority.footer}</p>{priority.id === "document" && <p>Aucune relance réelle n’est envoyée depuis cette démonstration.</p>}</>}
      </DetailDialog>
      <DetailDialog title="Note vocale transcrite" open={noteOpen} onClose={() => setNoteOpen(false)}>
        <p>Post-consultation #CL-4410</p><p>Note de démonstration : consultation terminée, suivi à planifier.</p><button className={styles.primaryAction} onClick={() => { setNoteValidated(true); setNoteOpen(false); }}>Valider la note de démonstration</button>
      </DetailDialog>
    </div>
  );
}
