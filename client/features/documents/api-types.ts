import type { PaginatedResponse as MedicalPaginatedResponse } from "@/features/medical/types";

export type PaginatedResponse<T> = MedicalPaginatedResponse<T>;

export type DocumentSystemType = "CLINICAL" | "ADMINISTRATIVE" | "CONSENT" | "OTHER";
export type ClinicalPhotoType = "BEFORE" | "AFTER" | "PROGRESS" | "OTHER";
export type ClinicalPhotoViewAngle = "FRONT" | "LEFT" | "RIGHT" | "OBLIQUE_LEFT" | "OBLIQUE_RIGHT" | "OTHER";

export interface DocumentCategoryApi {
  id: number;
  code: string;
  name: string;
  description: string;
  system_type: DocumentSystemType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentApi {
  id: number;
  patient: number;
  patient_reference: string;
  category: number;
  category_name: string;
  title: string;
  description: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  checksum: string;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
  document_date: string | null;
  consultation: number | null;
  surgery: number | null;
  prescription: number | null;
  care: number | null;
  appointment: number | null;
  surgery_consent: number | null;
  preoperative_requirement: number | null;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: number | null;
  archive_reason: string;
  created_at: string;
  updated_at: string;
}

export interface ClinicalPhotoSetApi {
  id: number;
  patient: number;
  surgery: number | null;
  consultation: number | null;
  title: string;
  anatomical_area: string;
  captured_at: string | null;
  created_by: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ClinicalPhotoApi {
  id: number;
  patient: number;
  patient_reference: string;
  surgery: number | null;
  consultation: number | null;
  photo_set: number | null;
  uploaded_by: number;
  uploaded_by_name: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  checksum: string;
  width: number;
  height: number;
  photo_type: ClinicalPhotoType;
  anatomical_area: string;
  view_angle: ClinicalPhotoViewAngle;
  captured_at: string | null;
  description: string;
  notes: string;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: number | null;
  archive_reason: string;
  created_at: string;
  updated_at: string;
}

export interface ClinicalPhotoComparisonApi {
  id: number;
  patient: number;
  surgery: number | null;
  before_photo: number;
  after_photo: number;
  created_by: number;
  notes: string;
  created_at: string;
}

export interface DocumentCategoryListParams {
  page?: number;
  search?: string;
  system_type?: DocumentSystemType | "";
  is_active?: boolean | "";
  ordering?: string;
}

export interface DocumentListParams {
  page?: number;
  patient?: number | string;
  category?: number | string;
  consultation?: number | string;
  surgery?: number | string;
  prescription?: number | string;
  care?: number | string;
  appointment?: number | string;
  uploaded_by?: number | string;
  document_date?: string;
  document_date__gte?: string;
  document_date__lte?: string;
  uploaded_at__date?: string;
  uploaded_at__gte?: string;
  uploaded_at__lte?: string;
  is_archived?: boolean | "";
  search?: string;
  ordering?: string;
}

export interface ClinicalPhotoSetListParams {
  page?: number;
  patient?: number | string;
  surgery?: number | string;
  consultation?: number | string;
  anatomical_area?: string;
  search?: string;
  ordering?: string;
}

export interface ClinicalPhotoListParams {
  page?: number;
  patient?: number | string;
  surgery?: number | string;
  consultation?: number | string;
  photo_type?: ClinicalPhotoType | "";
  anatomical_area?: string;
  captured_at__date?: string;
  captured_at__gte?: string;
  captured_at__lte?: string;
  uploaded_by?: number | string;
  is_archived?: boolean | "";
  photo_set?: number | string;
  search?: string;
  ordering?: string;
}

export interface ClinicalPhotoComparisonListParams {
  page?: number;
  patient?: number | string;
  surgery?: number | string;
  before_photo?: number | string;
  after_photo?: number | string;
  ordering?: string;
}

export interface CreateDocumentPayload {
  patient: number | string;
  category: number | string;
  title: string;
  file: File;
  description?: string;
  document_date?: string;
  consultation?: number | string;
  surgery?: number | string;
  prescription?: number | string;
  care?: number | string;
  appointment?: number | string;
  surgery_consent?: number | string;
  preoperative_requirement?: number | string;
}

export interface CreateClinicalPhotoSetPayload {
  patient: number | string;
  title: string;
  anatomical_area: string;
  surgery?: number | string;
  consultation?: number | string;
  captured_at?: string;
  notes?: string;
}

export interface CreateClinicalPhotoPayload {
  patient: number | string;
  image: File;
  photo_type: ClinicalPhotoType;
  anatomical_area: string;
  view_angle?: ClinicalPhotoViewAngle;
  surgery?: number | string;
  consultation?: number | string;
  photo_set?: number | string;
  captured_at?: string;
  description?: string;
  notes?: string;
}

export interface CreateClinicalPhotoComparisonPayload {
  patient: number | string;
  before_photo: number | string;
  after_photo: number | string;
  surgery?: number | string;
  notes?: string;
}
