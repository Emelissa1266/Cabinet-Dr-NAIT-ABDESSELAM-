import type { PaginatedResponse as MedicalPaginatedResponse } from "@/features/medical/types";

export type PaginatedResponse<T> = MedicalPaginatedResponse<T>;

export type SurgeryStatus = "DRAFT" | "PLANNED" | "PREOP_IN_PROGRESS" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type SurgeryPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SurgeryLaterality = "LEFT" | "RIGHT" | "BILATERAL" | "MIDLINE" | "NOT_APPLICABLE";
export type SurgeryAnesthesiaType = "LOCAL" | "REGIONAL" | "SEDATION" | "GENERAL" | "OTHER";

export type PreopReadinessStatus = "PENDING" | "NEEDS_REVIEW" | "READY" | "NOT_READY";
export type PreopChecklistStatus = "PENDING" | "COMPLETED" | "NOT_APPLICABLE" | "BLOCKED";
export type PreopRequirementType = "LAB" | "IMAGING" | "ANESTHESIA" | "MEDICAL_CLEARANCE" | "OTHER";
export type PreopRequirementStatus = "PENDING" | "SATISFIED" | "BLOCKED" | "WAIVED";
export type SurgeryConsentStatus = "PENDING" | "CONFIRMED" | "DECLINED" | "REVOKED";
export type SurgeryTeamRole = "SURGEON" | "ASSISTANT" | "NURSE" | "ANESTHESIA" | "OTHER";
export type IntraoperativeEventType = "MEDICATION" | "COMPLICATION" | "OBSERVATION" | "DEVICE" | "OTHER";
export type IntraoperativeSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "";
export type SurgeryComplicationSeverity = "MINOR" | "MODERATE" | "SEVERE" | "CRITICAL";

export interface InterventionTypeApi {
  id: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurgeryApi {
  id: number;
  patient: number;
  consultation: number | null;
  surgeon: number;
  intervention_type: number | null;
  intervention_type_name: string | null;
  intervention_type_code: string | null;
  procedure_name: string;
  procedure_code: string;
  procedure_description: string;
  indication: string;
  planned_date: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  status: SurgeryStatus;
  priority: SurgeryPriority;
  laterality: SurgeryLaterality | "";
  anatomical_site: string;
  anesthesia_type: SurgeryAnesthesiaType | "";
  notes: string;
  cancellation_reason: string;
  cancelled_by: number | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreoperativeAssessmentApi {
  id: number;
  surgery: number;
  assessed_by: number;
  assessment_date: string;
  medical_history_reviewed: boolean;
  allergies_reviewed: boolean;
  medications_reviewed: boolean;
  contraindications_reviewed: boolean;
  fasting_status: "UNKNOWN" | "CONFIRMED" | "NOT_FASTED" | "NOT_REQUIRED";
  anesthesia_evaluation_status: "PENDING" | "CLEARED" | "NEEDS_REVIEW" | "NOT_REQUIRED";
  required_tests_reviewed: boolean;
  pregnancy_status: "NOT_APPLICABLE" | "UNKNOWN" | "NEGATIVE" | "POSITIVE";
  readiness_status: PreopReadinessStatus;
  assessment_notes: string;
  created_at: string;
  updated_at: string;
}

export interface PreoperativeChecklistItemApi {
  id: number;
  name: string;
  description: string;
  category: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SurgeryPreoperativeChecklistApi {
  id: number;
  surgery: number;
  checklist_item: number;
  status: PreopChecklistStatus;
  checked_by: number | null;
  checked_at: string | null;
  notes: string;
}

export interface PreoperativeRequirementApi {
  id: number;
  surgery: number;
  name: string;
  description: string;
  requirement_type: PreopRequirementType;
  required: boolean;
  status: PreopRequirementStatus;
  result_summary: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SurgeryConsentApi {
  id: number;
  surgery: number;
  consent_type: string;
  required: boolean;
  status: SurgeryConsentStatus;
  confirmed_by: number | null;
  confirmed_at: string | null;
  notes: string;
}

export interface AnesthesiaRecordApi {
  id: number;
  surgery: number;
  anesthesia_type: SurgeryAnesthesiaType;
  provider_name: string;
  pre_anesthesia_notes: string;
  intraoperative_notes: string;
  post_anesthesia_notes: string;
  complications: string;
  created_at: string;
  updated_at: string;
}

export interface SurgeryOperativeRecordApi {
  id: number;
  surgery: number;
  surgeon: number;
  procedure_performed: string;
  operative_findings: string;
  operative_technique: string;
  actual_start_at: string;
  actual_end_at: string | null;
  anesthesia_type: SurgeryAnesthesiaType | "";
  estimated_blood_loss: string;
  complications: string;
  specimens: string;
  drains: string;
  implants_or_devices: string;
  immediate_postoperative_condition: string;
  operative_notes: string;
  created_at: string;
  updated_at: string;
}

export interface SurgeryTeamMemberApi {
  id: number;
  surgery: number;
  user: number | null;
  external_name: string;
  role: SurgeryTeamRole;
  notes: string;
  created_at: string;
}

export interface IntraoperativeEventApi {
  id: number;
  surgery: number;
  recorded_by: number;
  event_type: IntraoperativeEventType;
  description: string;
  occurred_at: string;
  severity: IntraoperativeSeverity;
  created_at: string;
}

export interface SurgeryComplicationApi {
  id: number;
  surgery: number;
  complication_type: string;
  description: string;
  severity: SurgeryComplicationSeverity;
  occurred_at: string;
  identified_by: number;
  action_taken: string;
  resolved: boolean;
  resolved_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PostoperativeAssessmentApi {
  id: number;
  surgery: number;
  assessed_by: number;
  assessed_at: string;
  general_condition: string;
  pain_score: number | null;
  consciousness_status: string;
  wound_status: string;
  bleeding_status: string;
  drain_status: string;
  nausea_vomiting: string;
  complications: string;
  instructions: string;
  disposition: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PostoperativeFollowUpApi {
  id: number;
  surgery: number;
  patient: number;
  doctor: number;
  follow_up_date: string;
  recovery_status: string;
  wound_assessment: string;
  pain_score: number | null;
  complications: string;
  clinical_findings: string;
  recommendations: string;
  next_follow_up_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SurgeryListParams {
  page?: number;
  patient?: number | string;
  surgeon?: number | string;
  status?: SurgeryStatus | "";
  search?: string;
  ordering?: string;
  planned_date__date?: string;
  planned_date__gte?: string;
  planned_date__lte?: string;
  intervention_type?: number | string;
}

export interface SurgeryPayload {
  patient: number;
  consultation?: number | null;
  intervention_type?: number | null;
  procedure_name?: string;
  procedure_code?: string;
  procedure_description?: string;
  indication: string;
  planned_date?: string | null;
  priority?: SurgeryPriority;
  laterality?: SurgeryLaterality | "";
  anatomical_site?: string;
  anesthesia_type?: SurgeryAnesthesiaType | "";
  notes?: string;
}

export type UpdateSurgeryPayload = Partial<SurgeryPayload>;

export interface SurgeryChildListParams {
  page?: number;
  surgery?: number | string;
  ordering?: string;
  search?: string;
  status?: string;
}

export type PreoperativeAssessmentPayload = Partial<Omit<PreoperativeAssessmentApi, "id" | "assessed_by" | "created_at" | "updated_at">> & { surgery: number };
export type SurgeryPreoperativeChecklistPayload = Partial<Omit<SurgeryPreoperativeChecklistApi, "id" | "checked_by" | "checked_at">> & { surgery: number; checklist_item: number };
export type PreoperativeRequirementPayload = Partial<Omit<PreoperativeRequirementApi, "id" | "reviewed_by" | "reviewed_at" | "created_at" | "updated_at">> & { surgery: number; name: string };
export type SurgeryConsentPayload = Partial<Omit<SurgeryConsentApi, "id" | "confirmed_by" | "confirmed_at">> & { surgery: number; consent_type: string };
export type AnesthesiaRecordPayload = Omit<AnesthesiaRecordApi, "id" | "created_at" | "updated_at">;
export type SurgeryOperativeRecordPayload = Omit<SurgeryOperativeRecordApi, "id" | "surgeon" | "created_at" | "updated_at">;
export type SurgeryTeamMemberPayload = Omit<SurgeryTeamMemberApi, "id" | "created_at">;
export type IntraoperativeEventPayload = Omit<IntraoperativeEventApi, "id" | "recorded_by" | "created_at">;
export type SurgeryComplicationPayload = Omit<SurgeryComplicationApi, "id" | "identified_by" | "created_at" | "updated_at">;
export type PostoperativeAssessmentPayload = Omit<PostoperativeAssessmentApi, "id" | "assessed_by" | "created_at" | "updated_at">;
export type PostoperativeFollowUpPayload = Omit<PostoperativeFollowUpApi, "id" | "doctor" | "created_at" | "updated_at">;
