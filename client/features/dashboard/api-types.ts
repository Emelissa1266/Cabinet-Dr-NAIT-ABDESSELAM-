export type DashboardRole = "ADMIN" | "DOCTOR" | "NURSE" | "SECRETARY";

export interface DashboardAppointmentPreview {
  id: number;
  patient_reference: string;
  start_at: string;
  status: string;
}

export interface DashboardSurgeryPreview {
  id: number;
  patient_reference: string;
  procedure_name: string;
  planned_date: string;
  status: string;
}

export interface DashboardCareSessionPreview {
  id: number;
  patient_reference: string;
  scheduled_at: string;
  status: string;
}

export interface DashboardFinancial {
  outstanding_amount: string;
  overdue_amount: string;
  paid_today: string;
  unpaid_invoices_count: number;
  partially_paid_invoices_count: number;
  overdue_invoices_count: number;
}

export interface DashboardActivity {
  actor: string;
  action: string;
  entity_type: string;
  created_at: string;
}

export interface DoctorDashboardApi {
  role: "DOCTOR";
  today: {
    appointments_count: number;
    appointments: DashboardAppointmentPreview[];
  };
  upcoming: {
    surgeries_count: number;
    surgeries: DashboardSurgeryPreview[];
    postoperative_followups_count: number;
  };
  pending: {
    preop_attention_count: number;
  };
  statistics: {
    unread_notifications_count: number;
  };
}

export interface NurseDashboardApi {
  role: "NURSE";
  today: {
    assigned_sessions_count: number;
    completed_sessions_count: number;
  };
  upcoming: {
    care_sessions_count: number;
    care_sessions: DashboardCareSessionPreview[];
  };
  pending: {
    in_progress_sessions_count: number;
    assigned_care_count: number;
  };
  statistics: {
    unread_notifications_count: number;
  };
}

export interface SecretaryDashboardApi {
  role: "SECRETARY";
  today: {
    appointments_count: number;
    patients_scheduled_count: number;
    checked_in_count: number;
    appointments: DashboardAppointmentPreview[];
  };
  upcoming: {
    appointments_count: number;
  };
  pending: {
    cancelled_count: number;
    no_show_count: number;
  };
  financial: DashboardFinancial;
  statistics: {
    unread_notifications_count: number;
  };
}

export interface AdminDashboardApi {
  role: "ADMIN";
  today: {
    appointments_count: number;
  };
  upcoming: {
    surgeries_count: number;
  };
  pending: {
    care_workload_count: number;
  };
  financial: DashboardFinancial;
  statistics: {
    active_users_count: number;
    notifications_unread_count: number;
    appointments_by_status: Record<string, number>;
  };
  recent_activity: DashboardActivity[];
}

export type DashboardApi = DoctorDashboardApi | NurseDashboardApi | SecretaryDashboardApi | AdminDashboardApi;
