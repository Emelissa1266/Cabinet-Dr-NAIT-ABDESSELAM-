import type { PaginatedResponse as MedicalPaginatedResponse } from "@/features/medical/types";

export type PaginatedResponse<T> = MedicalPaginatedResponse<T>;

export type CareStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type CareSessionStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ClinicalMeasurementType =
  | "TEMPERATURE"
  | "BLOOD_PRESSURE"
  | "HEART_RATE"
  | "OXYGEN_SATURATION"
  | "WEIGHT"
  | "PAIN_SCORE"
  | "OTHER";
export type CareParameterDataType = "TEXT" | "NUMBER" | "BOOLEAN" | "DATE";

export interface CareCategoryApi {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CareTypeApi {
  id: number;
  category: number;
  name: string;
  description: string;
  default_duration_minutes: number;
  default_price: string | null;
  requires_vital_signs: boolean;
  requires_observation: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CareApi {
  id: number;
  patient: number;
  patient_name: string;
  patient_reference: string;
  care_type: number;
  care_type_name: string;
  care_category_name: string;
  prescribed_by: number;
  prescribed_by_name: string;
  assigned_nurse: number | null;
  assigned_nurse_name: string;
  consultation: number | null;
  medical_instruction: number | null;
  surgery: number | null;
  start_date: string;
  end_date: string | null;
  planned_sessions: number;
  price_per_session: string;
  total_price: string;
  completed_sessions: number;
  remaining_sessions: number;
  progress_percentage: number;
  status: CareStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CareSessionApi {
  id: number;
  care: number;
  nurse: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: CareSessionStatus;
  notes: string;
  patient_name: string;
  patient_reference: string;
  care_type_name: string;
  care_category_name: string;
  care_status: CareStatus;
  care_start_date: string;
  care_total_price: string;
  planned_sessions: number;
  completed_sessions: number;
  remaining_sessions: number;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface CareObservationApi {
  id: number;
  care_session: number;
  nurse: number;
  observation: string;
  created_at: string;
  updated_at: string;
}

export interface ClinicalMeasurementApi {
  id: number;
  care_session: number;
  recorded_by: number;
  measurement_type: ClinicalMeasurementType;
  value: string;
  unit: string;
  recorded_at: string;
  notes: string;
  created_at: string;
}

export interface CareSessionMaterialApi {
  id: number;
  care_session: number;
  name: string;
  quantity: string;
  unit: string;
  notes: string;
  recorded_by: number;
  created_at: string;
}

export interface CareParameterDefinitionApi {
  id: number;
  care_type: number;
  key: string;
  label: string;
  data_type: CareParameterDataType;
  unit: string;
  required: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CareSessionParameterApi {
  id: number;
  care_session: number;
  parameter_definition: number;
  value: string;
  recorded_by: number;
  created_at: string;
  updated_at: string;
}

export interface CareListParams {
  page?: number;
  patient?: number | string;
  care_type?: number | string;
  care_type__category?: number | string;
  assigned_nurse?: number | string;
  prescribed_by?: number | string;
  surgery?: number | string;
  status?: CareStatus | "";
  start_date?: string;
  start_date__gte?: string;
  start_date__lte?: string;
  search?: string;
  ordering?: string;
}

export interface CareSessionListParams {
  page?: number;
  care?: number | string;
  care__patient?: number | string;
  nurse?: number | string;
  status?: CareSessionStatus | "";
  scheduled_at__date?: string;
  scheduled_at__gte?: string;
  scheduled_at__lte?: string;
  search?: string;
  ordering?: string;
}

export interface CareCategoryListParams {
  page?: number;
  is_active?: boolean | "";
  search?: string;
  ordering?: string;
}

export interface CareTypeListParams {
  page?: number;
  category?: number | string;
  is_active?: boolean | "";
  requires_vital_signs?: boolean | "";
  requires_observation?: boolean | "";
  search?: string;
  ordering?: string;
}

export interface CareObservationListParams {
  page?: number;
  care_session?: number | string;
  care_session__care?: number | string;
  care_session__care__patient?: number | string;
  nurse?: number | string;
  search?: string;
  ordering?: string;
}

export interface ClinicalMeasurementListParams {
  page?: number;
  care_session?: number | string;
  care_session__care__patient?: number | string;
  measurement_type?: ClinicalMeasurementType | "";
  recorded_by?: number | string;
  search?: string;
  ordering?: string;
}

export interface CareSessionMaterialListParams {
  page?: number;
  care_session?: number | string;
  recorded_by?: number | string;
  search?: string;
  ordering?: string;
}

export interface CareParameterDefinitionListParams {
  page?: number;
  care_type?: number | string;
  required?: boolean | "";
  active?: boolean | "";
  data_type?: CareParameterDataType | "";
  search?: string;
  ordering?: string;
}

export interface CareSessionParameterListParams {
  page?: number;
  care_session?: number | string;
  parameter_definition?: number | string;
  recorded_by?: number | string;
  search?: string;
  ordering?: string;
}

export interface CreateCarePayload {
  patient: number;
  care_type: number;
  assigned_nurse?: number | null;
  consultation?: number | null;
  medical_instruction?: number | null;
  surgery?: number | null;
  start_date: string;
  end_date?: string | null;
  planned_sessions: number;
  price_per_session: string;
  status?: CareStatus;
  notes?: string;
}

export type UpdateCarePayload = Partial<CreateCarePayload>;

export interface CreateCareSessionPayload {
  care: number;
  scheduled_at: string;
  notes?: string;
}

export interface UpdateCareSessionPayload {
  scheduled_at?: string;
  notes?: string;
}

export interface CreateCareObservationPayload {
  care_session: number;
  observation: string;
}

export type UpdateCareObservationPayload = Partial<CreateCareObservationPayload>;

export interface CreateClinicalMeasurementPayload {
  care_session: number;
  measurement_type: ClinicalMeasurementType;
  value: string;
  unit: string;
  recorded_at?: string;
  notes?: string;
}

export type UpdateClinicalMeasurementPayload = Partial<CreateClinicalMeasurementPayload>;

export interface CreateCareSessionMaterialPayload {
  care_session: number;
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export type UpdateCareSessionMaterialPayload = Partial<CreateCareSessionMaterialPayload>;

export interface CreateCareSessionParameterPayload {
  care_session: number;
  parameter_definition: number;
  value: string;
}

export type UpdateCareSessionParameterPayload = Partial<CreateCareSessionParameterPayload>;
