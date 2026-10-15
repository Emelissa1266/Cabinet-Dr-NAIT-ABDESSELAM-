import type { PaginatedResponse } from "@/features/medical/types";

export type PrescriptionStatus = "DRAFT" | "ACTIVE" | "CANCELLED" | "COMPLETED";

export interface PrescriptionItem {
  id: number;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number | null;
  instructions: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Prescription {
  id: number;
  patient_name: string;
  doctor_name: string;
  patient: number;
  consultation: number | null;
  surgery: number | null;
  doctor: number;
  prescribed_at: string;
  general_instructions: string;
  notes: string;
  status: PrescriptionStatus;
  items: PrescriptionItem[];
  created_at: string;
  updated_at: string;
}

export interface PrescriptionItemPayload {
  medication_name: string;
  dosage: string;
  frequency: string;
  route?: string;
  duration?: string;
  quantity?: number | null;
  instructions?: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface PrescriptionPayload {
  patient: number;
  consultation?: number | null;
  prescribed_at: string;
  general_instructions?: string;
  notes?: string;
  status?: PrescriptionStatus;
  items: PrescriptionItemPayload[];
}

export type UpdatePrescriptionPayload = Partial<Omit<PrescriptionPayload, "items">> & {
  items?: PrescriptionItemPayload[];
};

export interface PrescriptionListParams {
  page?: number;
  patient?: number | string;
  doctor?: number | string;
  status?: PrescriptionStatus | "";
  surgery?: number | string;
  prescribed_at?: string;
  prescribed_at__gte?: string;
  prescribed_at__lte?: string;
  search?: string;
  ordering?: string;
}

export type PrescriptionPage = PaginatedResponse<Prescription>;
