"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { DetailDialog } from "@/components/ui/detail-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/components/auth-provider";
import { listPatients } from "@/features/patients/services/patient-service";
import type { Patient } from "@/features/patients/types";
import { layoutAppointments } from "../lib/calendar-layout";
import { CalendarEvent } from "./calendar-event";
import type { AgendaStaff, Appointment, AppointmentStatus, AppointmentType, AvailabilitySlot } from "../types";
import {
  cancelAppointment,
  checkInAppointment,
  completeAppointment,
  confirmAppointment,
  createAppointment,
  getAvailability,
  getDayAgenda,
  getWeekAgenda,
  listAgendaStaff,
  listAppointmentTypes,
  markNoShow,
  rescheduleAppointment,
  startAppointment,
  updateAppointment,
} from "../services/agenda-service";
import { agendaErrorMessage, agendaFieldErrors, type FieldErrors } from "../services/agenda-errors";
import { labelClinicDate, localAppointmentIso, shiftClinicDate } from "../utils/clinic-time";
import ui from "@/components/ui/clinical.module.css";
import styles from "./calendar.module.css";

const today = () => new Date().toISOString().slice(0, 10);
const statusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Planifié",
  CONFIRMED: "Confirmé",
  CHECKED_IN: "Arrivé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
  NO_SHOW: "Absent",
};
const terminalStatuses: AppointmentStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

function mondayOf(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  return shiftClinicDate(date, -((value.getUTCDay() + 6) % 7));
}

function staffName(staff: AgendaStaff) {
  return staff.display_name || `${staff.first_name} ${staff.last_name}`.trim() || staff.username;
}

function firstAvailableStaff(staff: AgendaStaff[], type?: AppointmentType, currentUserId?: number) {
  const candidates = staff.filter((member) => {
    if (type?.requires_doctor) return member.role === "DOCTOR";
    if (type?.requires_nurse) return member.role === "NURSE";
    return ["ADMIN", "DOCTOR", "NURSE"].includes(member.role);
  });
  return candidates.find((member) => member.id === currentUserId) ?? candidates[0] ?? staff[0];
}

function field(errors: FieldErrors, name: string) {
  return errors[name] ? <span className={ui.muted}>{errors[name]}</span> : null;
}

function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function durationMinutes(appointment: Appointment) {
  const [startHour, startMinute] = appointment.start.split(":").map(Number);
  const [endHour, endMinute] = appointment.end.split(":").map(Number);
  return (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
}

export function AgendaCalendar({ basePath = "/agenda", initialDate = today(), initialCreate = false, initialPatientId }: { basePath?: string; initialDate?: string; initialCreate?: boolean; initialPatientId?: string }) {
  const { user } = useAuth();
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<"day" | "week">("week");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [staff, setStaff] = useState<AgendaStaff[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [formMode, setFormMode] = useState<"create" | "reschedule" | "edit" | null>(initialCreate ? "create" : null);
  const [category, setCategory] = useState<AppointmentType["category"] | "">("");
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [staffFilter, setStaffFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);

  const filters = useMemo(() => ({
    startDate: date,
    appointmentType: typeFilter,
    appointmentTypeCategory: category,
    primaryStaff: staffFilter,
    status,
    ordering: "start_at",
  }), [date, typeFilter, category, staffFilter, status]);

  const days = useMemo(() => {
    if (view === "day") return [date];
    const monday = mondayOf(date);
    return Array.from({ length: 7 }, (_, index) => shiftClinicDate(monday, index));
  }, [date, view]);

  const loadStaticData = useCallback(async () => {
    const [types, staffList, patientPage] = await Promise.all([
      listAppointmentTypes({ is_active: true }),
      listAgendaStaff(),
      listPatients({ search: initialPatientId, ordering: "last_name,first_name" }),
    ]);
    setAppointmentTypes(types);
    setStaff(staffList);
    setPatients(patientPage.results);
  }, [initialPatientId]);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (view === "day") {
        setAppointments(await getDayAgenda(filters, appointmentTypes));
      } else {
        const all = await getWeekAgenda(date, appointmentTypes);
        setAppointments(all.filter((item) =>
          (!category || item.typeCategory === category)
          && (!status || item.status === status)
          && (!staffFilter || item.primaryStaffId === Number(staffFilter))
          && (!typeFilter || item.appointmentTypeId === Number(typeFilter))
        ));
      }
    } catch (cause) {
      setAppointments([]);
      setError(agendaErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [appointmentTypes, category, date, filters, staffFilter, status, typeFilter, view]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStaticData().catch((cause) => setError(agendaErrorMessage(cause)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStaticData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAppointments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAppointments]);

  async function searchPatients(query: string) {
    setPatientQuery(query);
    const page = await listPatients({ search: query, ordering: "last_name,first_name" });
    setPatients(page.results);
  }

  async function refreshAfter(appointment?: Appointment) {
    await loadAppointments();
    if (appointment) setSelected(appointment);
  }

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const appointmentType = appointmentTypes.find((type) => type.id === Number(form.get("appointment_type")));
    const duration = Number(form.get("duration") || appointmentType?.default_duration_minutes || 30);
    const payload = {
      patient: Number(form.get("patient")),
      appointment_type: Number(form.get("appointment_type")),
      primary_staff: Number(form.get("primary_staff")),
      start_at: localAppointmentIso(String(form.get("date")), String(form.get("time"))),
      end_at: localAppointmentIso(String(form.get("date")), addMinutes(String(form.get("time")), duration)),
      reason: String(form.get("reason") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
      internal_notes: String(form.get("internal_notes") ?? "").trim(),
    };
    setBusy(true);
    setFeedback("");
    setErrors({});
    try {
      const saved = formMode === "edit" && selected
        ? await updateAppointment(selected.apiId, { reason: payload.reason, notes: payload.notes, internal_notes: payload.internal_notes })
        : await createAppointment(payload);
      setFormMode(null);
      setFeedback(formMode === "edit" ? "Rendez-vous mis à jour." : "Rendez-vous créé.");
      await refreshAfter(saved);
    } catch (cause) {
      setErrors(agendaFieldErrors(cause));
      setFeedback(agendaErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submitReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const form = new FormData(event.currentTarget);
    const duration = Number(form.get("duration") || 30);
    setBusy(true);
    setFeedback("");
    setErrors({});
    try {
      const saved = await rescheduleAppointment(selected.apiId, {
        new_start_at: localAppointmentIso(String(form.get("date")), String(form.get("time"))),
        new_end_at: localAppointmentIso(String(form.get("date")), addMinutes(String(form.get("time")), duration)),
        reason: String(form.get("reason") ?? "").trim(),
      });
      setFormMode(null);
      setFeedback("Rendez-vous déplacé.");
      await refreshAfter(saved);
    } catch (cause) {
      setErrors(agendaFieldErrors(cause));
      setFeedback(agendaErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(label: string, operation: () => Promise<Appointment>) {
    if (busy) return;
    setBusy(true);
    setPendingAction(label);
    setFeedback("");
    try {
      const saved = await operation();
      setFeedback("Statut du rendez-vous mis à jour.");
      await refreshAfter(saved);
    } catch (cause) {
      setFeedback(agendaErrorMessage(cause));
    } finally {
      setPendingAction("");
      setBusy(false);
    }
  }

  async function loadAvailability(form: HTMLFormElement) {
    const data = new FormData(form);
    setFeedback("");
    try {
      setAvailability(await getAvailability({
        staff: Number(data.get("primary_staff")),
        appointmentType: Number(data.get("appointment_type")),
        date: String(data.get("date")),
        durationMinutes: Number(data.get("duration") || 30),
      }));
    } catch (cause) {
      setAvailability([]);
      setFeedback(agendaErrorMessage(cause));
    }
  }

  const layouts = days.map((day) => layoutAppointments(appointments.filter((item) => item.date === day)));
  const widths = layouts.map((items) => Math.max(160, ...items.map((item) => item.columns * 160)));
  const selectedType = appointmentTypes[0];
  const defaultStaff = firstAvailableStaff(staff, selectedType, user?.id);

  return <div className={ui.page}>
    <header className={ui.heading}>
      <div><h1 className={ui.title}>Agenda</h1><p className={ui.description}>Planning synchronisé avec le backend · {appointments.length} rendez-vous affiché(s)</p></div>
      <div className={ui.actions}><button className={ui.action} onClick={() => window.print()}>Imprimer</button><button className={`${ui.action} ${ui.primary}`} onClick={() => { setFormMode("create"); setSelected(null); setErrors({}); setFeedback(""); }}>Nouveau rendez-vous</button></div>
    </header>
    <div className={styles.toolbar}>
      <div className={ui.actions}><button className={ui.action} aria-label="Période précédente" onClick={() => setDate(shiftClinicDate(date, view === "week" ? -7 : -1))}>‹</button><input type="date" aria-label="Date de l’agenda" value={date} onChange={(event) => event.target.value && setDate(event.target.value)} /><button className={ui.action} onClick={() => setDate(today())}>Aujourd’hui</button><button className={ui.action} aria-label="Période suivante" onClick={() => setDate(shiftClinicDate(date, view === "week" ? 7 : 1))}>›</button><strong>{labelClinicDate(days[0], { day: "numeric", month: "long" })}{view === "week" && ` — ${labelClinicDate(days[6], { day: "numeric", month: "long", year: "numeric" })}`}</strong></div>
      <div className={ui.actions}><div className={ui.tabs} aria-label="Vue du calendrier"><button className={ui.tab} aria-pressed={view === "day"} onClick={() => setView("day")}>Jour</button><button className={ui.tab} aria-pressed={view === "week"} onClick={() => setView("week")}>Semaine</button></div><select aria-label="Personnel" value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}><option value="">Tous les personnels</option>{staff.map((member) => <option key={member.id} value={member.id}>{staffName(member)} · {member.role}</option>)}</select><select aria-label="Type de rendez-vous" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Tous les types</option>{appointmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><select aria-label="Catégorie" value={category} onChange={(event) => setCategory(event.target.value as AppointmentType["category"] | "")}><option value="">Toutes catégories</option>{Array.from(new Set(appointmentTypes.map((type) => type.category))).map((value) => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Statut" value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus | "")}><option value="">Tous statuts</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    </div>
    {feedback && <p className={ui.panel} role="status">{feedback}</p>}
    {error && <p className={ui.empty} role="alert">{error}</p>}
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="Calendrier, défilement horizontal disponible">
      <div className={styles.grid} style={{ gridTemplateColumns: `60px ${widths.map((width) => `minmax(${width}px, 1fr)`).join(" ")}`, minWidth: 60 + widths.reduce((a, b) => a + b, 0) }}>
        <div className={styles.corner}>Heure</div>{days.map((day) => <button key={day} className={styles.dayHeading} data-active={day === date} onClick={() => { setDate(day); setView("day"); }}>{labelClinicDate(day, { weekday: "short" })}<strong>{labelClinicDate(day, { day: "numeric" })}</strong></button>)}
        <div className={styles.hours}>{Array.from({ length: 11 }, (_, hour) => <time key={hour} style={{ top: hour * 96 }}>{String(hour + 8).padStart(2, "0")}:00</time>)}</div>
        {days.map((day, index) => <div key={day} className={styles.day} aria-label={labelClinicDate(day, { dateStyle: "full" })}>{layouts[index].map((item) => <CalendarEvent key={item.appointment.id} item={item} onSelect={() => setSelected(item.appointment)} />)}</div>)}
      </div>
    </div>
    <div className={styles.legend}><span>Consultation</span><span>Préopératoire</span><span>Intervention</span><span>Soins</span><small>{loading ? "Chargement…" : "Backend agenda et disponibilité font autorité."}</small></div>
    {!loading && !layouts.some((items) => items.length) && <p className={ui.empty}>Aucun rendez-vous pour cette période et ces filtres.</p>}
    <DetailDialog title="Détail du rendez-vous" open={Boolean(selected)} onClose={() => setSelected(null)}>
      {selected && <AppointmentDetails basePath={basePath} appointment={selected} busy={busy} pendingAction={pendingAction} onEdit={() => setFormMode("edit")} onReschedule={() => setFormMode("reschedule")} onAction={runAction} />}
    </DetailDialog>
    <DetailDialog title={formMode === "reschedule" ? "Déplacer le rendez-vous" : formMode === "edit" ? "Modifier le rendez-vous" : "Nouveau rendez-vous"} open={Boolean(formMode)} onClose={() => setFormMode(null)}>
      {formMode === "reschedule" && selected ? <RescheduleForm appointment={selected} busy={busy} errors={errors} onCancel={() => setFormMode(null)} onSubmit={submitReschedule} onAvailability={loadAvailability} availability={availability} /> : formMode && <AppointmentForm appointment={formMode === "edit" ? selected : null} patients={patients} patientQuery={patientQuery} appointmentTypes={appointmentTypes} staff={staff} defaultStaff={defaultStaff} defaultDate={date} initialPatientId={initialPatientId} busy={busy} errors={errors} onPatientSearch={searchPatients} onCancel={() => setFormMode(null)} onSubmit={submitAppointment} onAvailability={loadAvailability} availability={availability} />}
    </DetailDialog>
  </div>;
}

function AppointmentDetails({ basePath, appointment, busy, pendingAction, onEdit, onReschedule, onAction }: { basePath: string; appointment: Appointment; busy: boolean; pendingAction: string; onEdit: () => void; onReschedule: () => void; onAction: (label: string, operation: () => Promise<Appointment>) => void }) {
  const [cancelReason, setCancelReason] = useState("");
  const patientBasePath = basePath.startsWith("/secretary") ? "/secretary/patients" : basePath.startsWith("/nurse") ? "/nurse/patients" : "/patients";
  const actions: { label: string; show: boolean; run: () => Promise<Appointment> }[] = [
    { label: "Confirmer", show: appointment.status === "SCHEDULED", run: () => confirmAppointment(appointment.apiId) },
    { label: "Marquer arrivé", show: appointment.status === "CONFIRMED", run: () => checkInAppointment(appointment.apiId) },
    { label: "Démarrer", show: appointment.status === "CHECKED_IN", run: () => startAppointment(appointment.apiId) },
    { label: "Terminer", show: appointment.status === "IN_PROGRESS", run: () => completeAppointment(appointment.apiId) },
    { label: "Absent", show: ["SCHEDULED", "CONFIRMED"].includes(appointment.status), run: () => markNoShow(appointment.apiId) },
  ];
  return <div className={ui.form}>
    <h3>{appointment.patient}</h3><StatusBadge tone={appointment.status === "CANCELLED" ? "error" : appointment.status === "SCHEDULED" ? "warning" : "teal"}>{appointment.statusLabel}</StatusBadge>
    <dl><dt>Référence patient</dt><dd>{appointment.patientReference}</dd><dt>Type</dt><dd>{appointment.type}</dd><dt>Date</dt><dd>{labelClinicDate(appointment.date, { dateStyle: "full" })}</dd><dt>Horaire</dt><dd>{appointment.start} – {appointment.end}</dd><dt>Personnel principal</dt><dd>{appointment.doctor}</dd><dt>Motif</dt><dd>{appointment.reason || "Non renseigné"}</dd><dt>Notes</dt><dd>{appointment.notes || "Aucune note"}</dd></dl>
    <div className={ui.actions}>{actions.filter((actionItem) => actionItem.show).map((actionItem) => <button key={actionItem.label} className={`${ui.action} ${ui.primary}`} disabled={busy} onClick={() => onAction(actionItem.label, actionItem.run)}>{pendingAction === actionItem.label ? "En cours…" : actionItem.label}</button>)}{!terminalStatuses.includes(appointment.status) && <button className={ui.action} disabled={busy} onClick={onReschedule}>Déplacer</button>}<button className={ui.action} disabled={busy} onClick={onEdit}>Modifier les notes</button><Link className={ui.action} href={`${patientBasePath}/${appointment.patientId}`}>Dossier patient</Link>{basePath.startsWith("/secretary") && <Link className={ui.action} href={`/secretary/billing?new=1&patient=${appointment.patientId}&appointment=${appointment.id}`}>Facturation</Link>}</div>
    {!terminalStatuses.includes(appointment.status) && <div><label>Motif d’annulation<input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Motif requis par le backend" /></label><button className={ui.action} disabled={busy || !cancelReason.trim()} onClick={() => onAction("Annuler", () => cancelAppointment(appointment.apiId, cancelReason))}>Annuler le rendez-vous</button></div>}
  </div>;
}

function AppointmentForm({ appointment, patients, patientQuery, appointmentTypes, staff, defaultStaff, defaultDate, initialPatientId, busy, errors, availability, onPatientSearch, onCancel, onSubmit, onAvailability }: { appointment: Appointment | null; patients: Patient[]; patientQuery: string; appointmentTypes: AppointmentType[]; staff: AgendaStaff[]; defaultStaff?: AgendaStaff; defaultDate: string; initialPatientId?: string; busy: boolean; errors: FieldErrors; availability: AvailabilitySlot[]; onPatientSearch: (query: string) => Promise<void>; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>; onAvailability: (form: HTMLFormElement) => Promise<void> }) {
  const type = appointmentTypes.find((item) => item.id === appointment?.appointmentTypeId) ?? appointmentTypes[0];
  const patientId = appointment?.patientId ?? Number(initialPatientId || patients[0]?.apiId || "");
  return <form className={ui.form} onSubmit={onSubmit}>
    <label>Rechercher patient<input value={patientQuery} onChange={(event) => void onPatientSearch(event.target.value)} placeholder="Nom, référence, téléphone..." /></label>
    <label>Patient *<select name="patient" required defaultValue={patientId || ""} disabled={Boolean(appointment)}><option value="" disabled>Sélectionner un patient</option>{patients.map((patient) => <option key={patient.apiId} value={patient.apiId}>{patient.name} · {patient.patientReference}</option>)}</select>{field(errors, "patient")}</label>
    <label>Type de rendez-vous *<select name="appointment_type" required defaultValue={appointment?.appointmentTypeId ?? type?.id ?? ""} disabled={Boolean(appointment)}>{appointmentTypes.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.default_duration_minutes} min</option>)}</select>{field(errors, "appointment_type")}</label>
    <label>Personnel principal *<select name="primary_staff" required defaultValue={appointment?.primaryStaffId ?? defaultStaff?.id ?? ""} disabled={Boolean(appointment)}><option value="" disabled>Sélectionner</option>{staff.map((member) => <option key={member.id} value={member.id}>{staffName(member)} · {member.role}</option>)}</select>{field(errors, "primary_staff")}</label>
    <div className={ui.actions}><label>Date *<input name="date" type="date" required defaultValue={appointment?.date ?? defaultDate} disabled={Boolean(appointment)} /></label><label>Heure *<input name="time" type="time" required defaultValue={appointment?.start ?? "09:00"} disabled={Boolean(appointment)} /></label><label>Durée *<input name="duration" type="number" min={5} max={480} required defaultValue={appointment ? durationMinutes(appointment) : type?.default_duration_minutes ?? 30} disabled={Boolean(appointment)} /></label></div>
    <label>Motif<input name="reason" defaultValue={appointment?.reason ?? ""} /></label>{field(errors, "reason")}
    <label>Notes d’accueil<textarea name="notes" defaultValue={appointment?.notes ?? ""} /></label>{field(errors, "notes")}
    <label>Notes internes<textarea name="internal_notes" defaultValue={appointment?.internalNotes ?? ""} /></label>{field(errors, "internal_notes")}
    {!appointment && <button type="button" className={ui.action} onClick={(event) => void onAvailability(event.currentTarget.form!)}>Voir les créneaux backend</button>}
    <AvailabilityList slots={availability} />
    <div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button><button type="button" className={ui.action} disabled={busy} onClick={onCancel}>Annuler</button></div>
  </form>;
}

function RescheduleForm({ appointment, busy, errors, availability, onCancel, onSubmit, onAvailability }: { appointment: Appointment; busy: boolean; errors: FieldErrors; availability: AvailabilitySlot[]; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>; onAvailability: (form: HTMLFormElement) => Promise<void> }) {
  return <form className={ui.form} onSubmit={onSubmit}>
    <input type="hidden" name="primary_staff" value={appointment.primaryStaffId} /><input type="hidden" name="appointment_type" value={appointment.appointmentTypeId} />
    <p>Le déplacement utilise l’action backend dédiée et conserve l’historique de replanification.</p>
    <div className={ui.actions}><label>Date *<input name="date" type="date" required defaultValue={appointment.date} /></label><label>Heure *<input name="time" type="time" required defaultValue={appointment.start} /></label><label>Durée *<input name="duration" type="number" min={5} max={480} required defaultValue={durationMinutes(appointment)} /></label></div>
    <label>Raison du déplacement<textarea name="reason" /></label>{field(errors, "new_start_at")}
    <button type="button" className={ui.action} onClick={(event) => void onAvailability(event.currentTarget.form!)}>Voir les créneaux backend</button>
    <AvailabilityList slots={availability} />
    <div className={ui.actions}><button className={`${ui.action} ${ui.primary}`} disabled={busy}>{busy ? "Déplacement…" : "Déplacer"}</button><button type="button" className={ui.action} disabled={busy} onClick={onCancel}>Annuler</button></div>
  </form>;
}

function AvailabilityList({ slots }: { slots: AvailabilitySlot[] }) {
  if (!slots.length) return null;
  return <div className={ui.panel}><h3>Créneaux disponibles</h3><div className={ui.actions}>{slots.slice(0, 24).map((slot) => <span className={ui.action} key={slot.start_at}>{labelClinicDate(slot.start_at.slice(0, 10), { weekday: "short", day: "numeric", month: "short" })} · {new Date(slot.start_at).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Algiers" })}</span>)}</div></div>;
}
