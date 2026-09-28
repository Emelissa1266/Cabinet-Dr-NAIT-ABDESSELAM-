export interface Appointment {
  id: string; patientId: string; patient: string; date: string;
  start: string; end: string; type: string;
  category: "consultation" | "preop" | "intervention" | "care";
  status: string; doctor: string; room: string; notes: string; intervention?: string;
}
