export type ConsultationType = "INITIAL" | "FOLLOW_UP" | "PRE_OPERATIVE" | "POST_OPERATIVE" | "OTHER";
export type ConsultationStatus = "DRAFT" | "COMPLETED" | "CANCELLED";
export type MedicalInstructionPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type MedicalInstructionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Consultation {
  id: number;
  patient: number;
  doctor: number;
  consultation_date: string;
  consultation_type: ConsultationType;
  reason: string;
  patient_complaint: string;
  clinical_findings: string;
  diagnosis: string;
  treatment_plan: string;
  recommendations: string;
  notes: string;
  status: ConsultationStatus;
  created_at: string;
  updated_at: string;
}

export interface ConsultationPayload {
  patient: number;
  consultation_date: string;
  consultation_type?: ConsultationType;
  reason: string;
  patient_complaint?: string;
  clinical_findings?: string;
  diagnosis?: string;
  treatment_plan?: string;
  recommendations?: string;
  notes?: string;
  status?: ConsultationStatus;
}

export type UpdateConsultationPayload = Partial<ConsultationPayload>;

export interface ConsultationListParams {
  page?: number;
  patient?: number | string;
  doctor?: number | string;
  status?: ConsultationStatus | "";
  consultation_type?: ConsultationType | "";
  consultation_date?: string;
  consultation_date__gte?: string;
  consultation_date__lte?: string;
  search?: string;
  ordering?: string;
}

export interface MedicalInstruction {
  id: number;
  patient: number;
  consultation: number | null;
  surgery: number | null;
  doctor: number;
  title: string;
  instruction: string;
  priority: MedicalInstructionPriority;
  status: MedicalInstructionStatus;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicalInstructionPayload {
  patient: number;
  consultation?: number | null;
  title: string;
  instruction: string;
  priority?: MedicalInstructionPriority;
  status?: MedicalInstructionStatus;
  valid_from?: string | null;
  valid_until?: string | null;
}

export type UpdateMedicalInstructionPayload = Partial<MedicalInstructionPayload>;

export interface MedicalInstructionListParams {
  page?: number;
  patient?: number | string;
  doctor?: number | string;
  status?: MedicalInstructionStatus | "";
  priority?: MedicalInstructionPriority | "";
  surgery?: number | string;
  search?: string;
  ordering?: string;
}
