import { apiRequest } from "@/lib/api-client";
import type {
  AgendaStaff,
  Appointment,
  AppointmentListParams,
  AppointmentType,
  AvailabilitySlot,
  BackendAppointment,
  CreateAppointmentPayload,
  PaginatedResponse,
  RescheduleAppointmentPayload,
  UpdateAppointmentPayload,
} from "../types";
import { clinicDateKey, clinicTime } from "../utils/clinic-time";

const statusLabels: Record<Appointment["status"], string> = {
  SCHEDULED: "Planifié",
  CONFIRMED: "Confirmé",
  CHECKED_IN: "Arrivé",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminé",
  CANCELLED: "Annulé",
  NO_SHOW: "Absent",
};

const categoryMap: Record<AppointmentType["category"], Appointment["category"]> = {
  CONSULTATION: "consultation",
  FOLLOW_UP: "consultation",
  SURGERY: "intervention",
  NURSING_CARE: "care",
  PREOPERATIVE: "preop",
  POSTOPERATIVE: "care",
  OTHER: "consultation",
};

function queryString(params: Record<string, string | number | boolean | undefined | null>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

function appointmentQuery(params: AppointmentListParams = {}) {
  return queryString({
    page: params.page && params.page > 1 ? params.page : undefined,
    search: params.search?.trim(),
    patient: params.patient,
    appointment_type: params.appointmentType,
    appointment_type__category: params.appointmentTypeCategory,
    primary_staff: params.primaryStaff,
    status: params.status,
    start_at__date: params.startDate,
    start_at__gte: params.startDateGte,
    start_at__lte: params.startDateLte,
    ordering: params.ordering,
  });
}

export function mapAppointment(appointment: BackendAppointment, types: AppointmentType[] = []): Appointment {
  const appointmentType = types.find((item) => item.id === appointment.appointment_type);
  const typeCategory = appointmentType?.category ?? "OTHER";
  return {
    id: String(appointment.id),
    apiId: appointment.id,
    patientId: appointment.patient,
    patientReference: appointment.patient_reference,
    patient: appointment.patient_name || appointment.patient_reference,
    appointmentTypeId: appointment.appointment_type,
    type: appointment.appointment_type_name,
    typeCategory,
    category: categoryMap[typeCategory],
    primaryStaffId: appointment.primary_staff,
    doctor: appointment.primary_staff_name || `Utilisateur #${appointment.primary_staff}`,
    date: clinicDateKey(appointment.start_at),
    start: clinicTime(appointment.start_at),
    end: clinicTime(appointment.end_at),
    startAt: appointment.start_at,
    endAt: appointment.end_at,
    status: appointment.status,
    statusLabel: statusLabels[appointment.status],
    reason: appointment.reason,
    notes: appointment.notes,
    internalNotes: appointment.internal_notes,
    consultation: appointment.consultation,
    surgery: appointment.surgery,
    careSession: appointment.care_session,
    cancellationReason: appointment.cancellation_reason,
    createdAt: appointment.created_at,
    updatedAt: appointment.updated_at,
  };
}

async function mapPage(response: PaginatedResponse<BackendAppointment>, types?: AppointmentType[]) {
  const appointmentTypes = types ?? await listAppointmentTypes({ is_active: true });
  return { ...response, results: response.results.map((item) => mapAppointment(item, appointmentTypes)) };
}

export async function listAppointmentTypes(params: { is_active?: boolean | ""; category?: string } = {}) {
  const response = await apiRequest<PaginatedResponse<AppointmentType>>(`appointment-types/${queryString(params)}`);
  return response.results;
}

export async function listAgendaStaff() {
  return apiRequest<AgendaStaff[]>("agenda/staff/");
}

export async function listAppointments(params?: AppointmentListParams, types?: AppointmentType[]) {
  const response = await apiRequest<PaginatedResponse<BackendAppointment>>(`appointments/${appointmentQuery(params)}`);
  return mapPage(response, types);
}

export async function getAppointment(id: string | number, types?: AppointmentType[]) {
  const appointment = await apiRequest<BackendAppointment>(`appointments/${id}/`);
  return mapAppointment(appointment, types);
}

export async function getDayAgenda(params: AppointmentListParams, types?: AppointmentType[]) {
  const query = queryString({
    date: params.startDate,
    staff: params.primaryStaff,
    appointment_type: params.appointmentType,
    status: params.status,
  });
  const response = await apiRequest<BackendAppointment[]>(`agenda/day/${query}`);
  const appointmentTypes = types ?? await listAppointmentTypes({ is_active: true });
  return response.map((item) => mapAppointment(item, appointmentTypes));
}

export async function getWeekAgenda(date: string, types?: AppointmentType[]) {
  const response = await apiRequest<BackendAppointment[]>(`agenda/week/${queryString({ date })}`);
  const appointmentTypes = types ?? await listAppointmentTypes({ is_active: true });
  return response.map((item) => mapAppointment(item, appointmentTypes));
}

export async function createAppointment(payload: CreateAppointmentPayload) {
  return mapAppointment(await apiRequest<BackendAppointment>("appointments/", { method: "POST", body: payload }));
}

export async function updateAppointment(id: string | number, payload: UpdateAppointmentPayload) {
  return mapAppointment(await apiRequest<BackendAppointment>(`appointments/${id}/`, { method: "PATCH", body: payload }));
}

async function action(id: string | number, name: string, body?: object) {
  return mapAppointment(await apiRequest<BackendAppointment>(`appointments/${id}/${name}/`, { method: "POST", body }));
}

export const confirmAppointment = (id: string | number) => action(id, "confirm");
export const checkInAppointment = (id: string | number) => action(id, "check-in");
export const startAppointment = (id: string | number) => action(id, "start");
export const completeAppointment = (id: string | number) => action(id, "complete");
export const markNoShow = (id: string | number) => action(id, "no-show");
export const cancelAppointment = (id: string | number, reason: string) => action(id, "cancel", { reason });
export const rescheduleAppointment = (id: string | number, payload: RescheduleAppointmentPayload) => action(id, "reschedule", payload);

export function getAvailability(params: { staff: number | string; appointmentType: number | string; date?: string; dateFrom?: string; dateTo?: string; durationMinutes?: number | string }) {
  return apiRequest<AvailabilitySlot[]>(`availability/${queryString({
    staff: params.staff,
    appointment_type: params.appointmentType,
    date: params.date,
    date_from: params.dateFrom,
    date_to: params.dateTo,
    duration_minutes: params.durationMinutes,
  })}`);
}

export const agendaService = {
  listAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  confirmAppointment,
  checkInAppointment,
  startAppointment,
  completeAppointment,
  cancelAppointment,
  markNoShow,
  rescheduleAppointment,
  getAvailability,
  getDayAgenda,
  getWeekAgenda,
  listAppointmentTypes,
  listAgendaStaff,
};
