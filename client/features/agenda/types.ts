export const appointmentStatuses = ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const appointmentTypeCategories = ["CONSULTATION", "FOLLOW_UP", "SURGERY", "NURSING_CARE", "PREOPERATIVE", "POSTOPERATIVE", "OTHER"] as const;
export type AppointmentTypeCategory = (typeof appointmentTypeCategories)[number];

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AppointmentType {
  id: number;
  name: string;
  code: string;
  description: string;
  default_duration_minutes: number;
  category: AppointmentTypeCategory;
  is_active: boolean;
  requires_doctor: boolean;
  requires_nurse: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgendaStaff {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "ADMIN" | "DOCTOR" | "NURSE" | "SECRETARY";
  professional_title: string;
  display_name: string;
  is_active: boolean;
}

export interface AppointmentStaffInput {
  user: number;
  role?: string;
  is_required?: boolean;
  notes?: string;
}

export interface BackendAppointment {
  id: number;
  patient: number;
  patient_reference: string;
  patient_name: string;
  appointment_type: number;
  appointment_type_name: string;
  primary_staff: number;
  primary_staff_name: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  reason: string;
  notes: string;
  internal_notes: string;
  consultation: number | null;
  surgery: number | null;
  care_session: number | null;
  staff_members: AppointmentStaffInput[];
  created_by: number | null;
  cancelled_by: number | null;
  cancelled_at: string | null;
  cancellation_reason: string;
  checked_in_at: string | null;
  no_show_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  apiId: number;
  patientId: number;
  patientReference: string;
  patient: string;
  appointmentTypeId: number;
  type: string;
  typeCategory: AppointmentTypeCategory;
  category: "consultation" | "preop" | "intervention" | "care";
  primaryStaffId: number;
  doctor: string;
  date: string;
  start: string;
  end: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  statusLabel: string;
  reason: string;
  notes: string;
  internalNotes: string;
  consultation: number | null;
  surgery: number | null;
  careSession: number | null;
  cancellationReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentListParams {
  page?: number;
  search?: string;
  patient?: number | string;
  appointmentType?: number | string;
  appointmentTypeCategory?: AppointmentTypeCategory | "";
  primaryStaff?: number | string;
  status?: AppointmentStatus | "";
  startDate?: string;
  startDateGte?: string;
  startDateLte?: string;
  ordering?: string;
}

export interface CreateAppointmentPayload {
  patient: number;
  appointment_type: number;
  primary_staff: number;
  start_at: string;
  end_at?: string;
  reason?: string;
  notes?: string;
  internal_notes?: string;
  staff_members?: AppointmentStaffInput[];
}

export interface UpdateAppointmentPayload {
  reason?: string;
  notes?: string;
  internal_notes?: string;
  consultation?: number | null;
  surgery?: number | null;
  care_session?: number | null;
}

export interface RescheduleAppointmentPayload {
  new_start_at: string;
  new_end_at?: string;
  reason?: string;
}

export interface AvailabilitySlot {
  start_at: string;
  end_at: string;
}
