export type LeaveStatus = "DRAFT" | "ISSUED" | "CANCELLED";
export interface WorkLeave {
  id: number; patient: number; patient_name: string; patient_birth_date: string | null;
  consultation: number | null; doctor: number; doctor_name: string; certificate_number: string;
  leave_type: "INITIAL" | "EXTENSION"; previous_leave: number | null; previous_reference: string;
  previous_start_date: string | null; previous_end_date: string | null;
  issued_date: string; start_date: string; end_date: string; duration_days: number;
  medical_reason: string; internal_notes: string; patient_instructions: string; status: LeaveStatus;
  issued_at: string | null; cancelled_at: string | null; cancellation_reason: string;
  created_at: string; updated_at: string; history: {action: string; created_at: string}[];
}
export type LeavePayload = Pick<WorkLeave, "patient" | "consultation" | "leave_type" | "previous_leave" | "issued_date" | "start_date" | "end_date" | "medical_reason" | "internal_notes" | "patient_instructions">;
