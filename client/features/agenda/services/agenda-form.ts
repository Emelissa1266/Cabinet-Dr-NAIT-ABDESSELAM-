import type { AgendaStaff, AppointmentType, CreateAppointmentPayload } from "../types";
import { localAppointmentIso } from "../utils/clinic-time";

export function staffMatchesAppointmentType(staff: AgendaStaff, type?: AppointmentType) {
  if (!type) return ["ADMIN", "DOCTOR", "NURSE"].includes(staff.role);
  if (type.requires_doctor) return staff.role === "DOCTOR";
  if (type.requires_nurse) return staff.role === "NURSE";
  return ["ADMIN", "DOCTOR", "NURSE"].includes(staff.role);
}

export function compatibleAgendaStaff(staff: AgendaStaff[], type?: AppointmentType) {
  return staff.filter((member) => staffMatchesAppointmentType(member, type));
}

export function defaultAgendaStaff(staff: AgendaStaff[], type?: AppointmentType, currentUserId?: number) {
  const compatible = compatibleAgendaStaff(staff, type);
  return compatible.find((member) => member.id === currentUserId) ?? compatible[0];
}

export function appointmentTypeDuration(type?: AppointmentType) {
  return type?.default_duration_minutes && type.default_duration_minutes > 0 ? type.default_duration_minutes : 30;
}

export function buildCreateAppointmentPayload({
  patient,
  appointmentType,
  primaryStaff,
  date,
  time,
  reason,
  notes,
  internalNotes,
}: {
  patient: number;
  appointmentType: number;
  primaryStaff: number;
  date: string;
  time: string;
  reason?: string;
  notes?: string;
  internalNotes?: string;
}): CreateAppointmentPayload {
  return {
    patient,
    appointment_type: appointmentType,
    primary_staff: primaryStaff,
    start_at: localAppointmentIso(date, time),
    reason: reason?.trim() ?? "",
    notes: notes?.trim() ?? "",
    internal_notes: internalNotes?.trim() ?? "",
  };
}
