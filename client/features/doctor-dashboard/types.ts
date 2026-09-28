export type AppointmentStatus = "waiting-room" | "confirmed" | "prepared" | "pending";
export interface DashboardAppointment {
  id: string;
  patientId: string;
  patientName: string;
  startTime: string;
  endTime: string;
  type: string;
  description: string;
  status: AppointmentStatus;
  room?: string;
}
export interface DashboardPriority {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  footer: string;
  action: string;
  tone: "teal" | "warning" | "neutral";
  icon: "follow-up" | "missing-document" | "scheduled-procedure";
  time?: string;
}
export interface DoctorDashboardData {
  date: string;
  doctorName: string;
  room: string;
  summary: { appointments: number; interventions: number; followUps: number };
  appointments: DashboardAppointment[];
  priorities: DashboardPriority[];
}
