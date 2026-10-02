import type { Appointment } from "@/features/agenda/types";
import { labelClinicDate } from "@/features/agenda/utils/clinic-time";

export function patientAppointmentDateTime(appointment: Appointment) {
  return `${labelClinicDate(appointment.date, { dateStyle: "long" })} · ${appointment.start}`;
}

export function patientAppointmentSummary(appointment: Appointment) {
  return {
    title: appointment.type || "Rendez-vous",
    dateTime: patientAppointmentDateTime(appointment),
    staff: appointment.doctor || "Personnel non renseigné",
    status: appointment.statusLabel,
    reason: appointment.reason || "Motif non renseigné",
  };
}

export function patientAppointmentHref(basePath: string, appointment: Appointment) {
  const agendaPath = basePath.startsWith("/secretary") ? "/secretary/agenda" : basePath.startsWith("/nurse") ? "/nurse/agenda" : "/agenda";
  return `${agendaPath}?appointment=${appointment.apiId}`;
}
