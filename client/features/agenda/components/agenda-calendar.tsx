"use client";
import { useState } from "react";
import Link from "next/link";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { layoutAppointments } from "../lib/calendar-layout";
import { CalendarEvent } from "./calendar-event";
import type { Appointment } from "../types";
import ui from "@/components/ui/clinical.module.css";
import styles from "./calendar.module.css";
const iso = (date: Date) => date.toISOString().slice(0, 10);
const dateFrom = (date: string) => new Date(date + "T12:00:00Z");
const shift = (date: string, days: number) => { const value = dateFrom(date); value.setUTCDate(value.getUTCDate() + days); return iso(value); };
const labelDate = (date: string, options: Intl.DateTimeFormatOptions) => dateFrom(date).toLocaleDateString("fr-FR", { ...options, timeZone: "UTC" });
export function AgendaCalendar({ appointments, initialDate }: { appointments: Appointment[]; initialDate: string }) {
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<"day" | "week">("week");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const monday = shift(date, -((dateFrom(date).getUTCDay() + 6) % 7));
  const days = Array.from({ length: view === "week" ? 7 : 1 }, (_, index) => view === "week" ? shift(monday, index) : date);
  const layouts = days.map((day) => layoutAppointments(appointments.filter((item) => item.date === day && (category === "all" || item.category === category) && (status === "all" || item.status === status))));
  const widths = layouts.map((items) => Math.max(160, ...items.map((item) => item.columns * 160)));
  return <div className={ui.page}>
    <header className={ui.heading}><div><h1 className={ui.title}>Agenda</h1><p className={ui.description}>Planning du Dr. Gaya · Démonstration du 14 au 20 septembre 2026</p></div><div className={ui.actions}><button className={ui.action} onClick={() => window.print()}>Imprimer le semainier</button><button className={`${ui.action} ${ui.primary}`} disabled title="La création sera disponible avec le service de rendez-vous">Nouveau rendez-vous</button></div></header>
    <div className={styles.toolbar}>
      <div className={ui.actions}><button className={ui.action} aria-label="Période précédente" onClick={() => setDate(shift(date, view === "week" ? -7 : -1))}>‹</button><button className={ui.action} onClick={() => setDate(iso(new Date()))}>Aujourd’hui</button><button className={ui.action} aria-label="Période suivante" onClick={() => setDate(shift(date, view === "week" ? 7 : 1))}>›</button><strong>{labelDate(days[0], { day: "numeric", month: "long" })}{view === "week" && ` — ${labelDate(days[6], { day: "numeric", month: "long", year: "numeric" })}`}</strong></div>
      <div className={ui.actions}><div className={ui.tabs} aria-label="Vue du calendrier"><button className={ui.tab} aria-pressed={view === "day"} onClick={() => setView("day")}>Jour</button><button className={ui.tab} aria-pressed={view === "week"} onClick={() => setView("week")}>Semaine</button></div><label>Type d’acte <select value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">Tous</option><option value="consultation">Consultation</option><option value="preop">Préopératoire</option><option value="intervention">Intervention</option><option value="care">Soins</option></select></label><label>Statut <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Tous</option>{Array.from(new Set(appointments.map((item) => item.status))).map((value) => <option key={value}>{value}</option>)}</select></label><button className={ui.action} onClick={() => { setCategory("all"); setStatus("all"); setDate(initialDate); }}>Réinitialiser</button></div>
    </div>
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="Calendrier, défilement horizontal disponible">
      <div className={styles.grid} style={{ gridTemplateColumns: `60px ${widths.map((width) => `minmax(${width}px, 1fr)`).join(" ")}`, minWidth: 60 + widths.reduce((a, b) => a + b, 0) }}>
        <div className={styles.corner}>Heure</div>{days.map((day) => <button key={day} className={styles.dayHeading} data-active={day === date} onClick={() => { setDate(day); setView("day"); }}>{labelDate(day, { weekday: "short" })}<strong>{labelDate(day, { day: "numeric" })}</strong></button>)}
        <div className={styles.hours}>{Array.from({ length: 11 }, (_, hour) => <time key={hour} style={{ top: hour * 96 }}>{String(hour + 8).padStart(2, "0")}:00</time>)}</div>
        {days.map((day, index) => <div key={day} className={styles.day} aria-label={labelDate(day, { dateStyle: "full" })}>{layouts[index].map((item) => <CalendarEvent key={item.appointment.id} item={item} onSelect={() => setSelected(item.appointment)} />)}</div>)}
      </div>
    </div>
    <div className={styles.legend}><span>Consultation postopératoire</span><span>Préopératoire</span><span>Intervention</span><span>Contrôle & soins</span><small>Cliquez sur un rendez-vous pour consulter les détails.</small></div>
    {!layouts.some((items) => items.length) && <p className={ui.empty}>Aucun rendez-vous pour cette période et ces filtres.</p>}
    <DetailDialog title="Détail du rendez-vous" open={Boolean(selected)} onClose={() => setSelected(null)}>{selected && <><h3>{selected.patient}</h3><StatusBadge tone="teal">{selected.status}</StatusBadge><dl><dt>Type d’acte</dt><dd>{selected.type}</dd><dt>Date</dt><dd>{labelDate(selected.date, { dateStyle: "full" })}</dd><dt>Horaire</dt><dd>{selected.start} – {selected.end}</dd><dt>Praticien</dt><dd>{selected.doctor}</dd><dt>Lieu</dt><dd>{selected.room}</dd>{selected.intervention && <><dt>Intervention</dt><dd>{selected.intervention}</dd></>}<dt>Notes préparatoires</dt><dd>{selected.notes}</dd></dl><Link className={ui.action} href={`/patients/${selected.patientId}`}>Consulter le dossier patient</Link></>}</DetailDialog>
  </div>;
}
