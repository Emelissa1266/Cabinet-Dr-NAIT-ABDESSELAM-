export const patientGenders = ["FEMALE", "MALE", "OTHER", "UNKNOWN"] as const;
export type PatientGender = (typeof patientGenders)[number];

export interface MedicalInfoItem {
  id: number;
  title: string;
  description: string;
  is_active: boolean;
  created_at: string;
  severity?: string;
  surgery_date?: string | null;
  diagnosed_at?: string | null;
  dosage?: string;
  frequency?: string;
}

export interface PatientMedicalInformation {
  allergies: MedicalInfoItem[];
  medical_history: MedicalInfoItem[];
  surgical_history: MedicalInfoItem[];
  chronic_conditions: MedicalInfoItem[];
  medications: MedicalInfoItem[];
  contraindications: MedicalInfoItem[];
  clinical_notes: { id: number; note: string; created_at: string }[];
}

export type MedicalAlertCategory = "ALLERGY" | "MEDICATION" | "CONTRAINDICATION" | "MEDICAL_CONDITION" | "ANESTHESIA" | "OTHER";
export type MedicalAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface MedicalAlert {
  id: number;
  patient: number;
  patient_name: string;
  category: MedicalAlertCategory;
  severity: MedicalAlertSeverity;
  title: string;
  description: string;
  is_active: boolean;
  created_by: number | null;
  created_by_name: string;
  resolved_by: number | null;
  resolved_by_name: string;
  resolved_at: string | null;
  resolution_note: string;
  created_at: string;
  updated_at: string;
}

export interface MedicalAlertPayload {
  patient: number;
  category: MedicalAlertCategory;
  severity: MedicalAlertSeverity;
  title: string;
  description?: string;
}

export interface BackendPatient {
  id: number;
  patient_reference: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: PatientGender;
  phone: string;
  email: string;
  address: string;
  city: string;
  emergency_contact: string;
  emergency_phone: string;
  profession: string;
  notes: string;
  is_active: boolean;
  medical_information: PatientMedicalInformation | null;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  created_by_name: string;
  updated_by: number | null;
  updated_by_name: string;
}

export interface Patient {
  id: string;
  apiId: number;
  patientReference: string;
  firstName: string;
  lastName: string;
  name: string;
  initials: string;
  age: number | null;
  dateOfBirth: string | null;
  gender: PatientGender;
  phone: string;
  email: string;
  address: string;
  city: string;
  emergencyContact: string;
  emergencyPhone: string;
  profession: string;
  notes: string;
  isActive: boolean;
  status: string;
  category: "active" | "inactive";
  medicalInformation: PatientMedicalInformation | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PatientListParams {
  page?: number;
  search?: string;
  ordering?: string;
  gender?: PatientGender | "";
  isActive?: boolean | "";
}

export interface PatientPayload {
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: PatientGender;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  profession?: string;
  notes?: string;
  is_active?: boolean;
}

export type CreatePatientPayload = PatientPayload;
export type UpdatePatientPayload = Partial<PatientPayload>;
